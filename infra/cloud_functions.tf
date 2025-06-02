locals {
  project_id            = var.project_id
  region                = var.region
  function_sa_name      = "cf-pixel-to-firestore"
  service_account_roles = [
    "roles/storage.admin",
    "roles/iam.serviceAccountUser",
    "roles/cloudfunctions.developer",
    "roles/cloudfunctions.serviceAgent",
    "roles/pubsub.publisher",
    "roles/datastore.user
  ]
}

resource "google_service_account" "function_sa" {
  account_id   = local.function_sa_name
  project      = var.project_id
  display_name = "Service Account for Cloud Function Mutate Create Campaign"
  depends_on = [module.project-services]
}

resource "google_project_iam_member" "function_sa_roles" {
  for_each = toset(local.service_account_roles)
  role     = each.value
  member   = "serviceAccount:${google_service_account.function_sa.email}"
  project  = var.project_id
  depends_on = [google_service_account.function_sa]
}

resource "google_storage_bucket" "cloud_function_source_bucket" {
  name                        = "cloud-function-alert-${var.project_id}"
  project                     = var.project_id
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true
  depends_on = [module.project-services]
}

resource "google_storage_bucket" "input_bucket" {
  name                        = "cloud-alert-input-${var.project_id}"
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  depends_on = [module.project-services]
}

data "google_storage_project_service_account" "gcs_account" {
  project = var.project_id
}

# ----------------------------------- #

data "archive_file" "source_pixel_to_firestore" {
  type        = "zip"
  output_path = "${path.module}/cloud_functions_build/pixel_to_firestore.zip"
  source_dir  = "${path.module}/cloud_functions/pixel_to_firestore"
}


# ----------------------------------- #

resource "google_storage_bucket_object" "zip_pixel_to_firestore" {
  source       = data.archive_file.source_pixel_to_firestore.output_path
  content_type = "application/zip"
  name         = "pixel_to_firestore-${data.archive_file.source_pixel_to_firestore.output_md5}.zip"
  bucket       = google_storage_bucket.cloud_function_source_bucket.name
  metadata = {
    source_hash = data.archive_file.source_pixel_to_firestore.output_md5
  }
  depends_on = [
    google_storage_bucket.cloud_function_source_bucket,
    data.archive_file.source_pixel_to_firestore
  ]
}

# ----------------------------------- #

resource "google_cloudfunctions2_function" "function_pixel_to_firestore" {
  name     = "pixel-to-firestore"
  location = var.region
  project  = var.project_id
  build_config {
    runtime     = "nodejs20"
    entry_point = "main"
    source {
      storage_source {
        bucket = google_storage_bucket.cloud_function_source_bucket.name
        object = google_storage_bucket_object.zip_pixel_to_firestore.name
      }
    }
  }
  event_trigger {
    trigger_region = local.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = "projects/${local.project_id}/topics/pixel-events"
    retry_policy   = "RETRY_POLICY_RETRY"
  }
  service_config {
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    ingress_settings               = "ALLOW_ALL"
    service_account_email          = google_service_account.function_sa.email
  }
  depends_on = [
    google_storage_bucket_object.zip_pixel_to_firestore,
    module.project-services
  ]
}

# ----------------------------------- #

data "google_iam_policy" "invoker_function_pixel_to_firestore" {
  binding {
    role    = "roles/run.invoker"
    members = ["allUsers"]
  }
}

# ----------------------------------- #

resource "google_cloud_run_v2_service_iam_policy" "invoker_pixel_to_firestore" {
  project     = google_cloudfunctions2_function.function_pixel_to_firestore.project
  location    = google_cloudfunctions2_function.function_pixel_to_firestore.location
  name        = google_cloudfunctions2_function.function_pixel_to_firestore.name
  policy_data = data.google_iam_policy.invoker_function_pixel_to_firestore.policy_data
  depends_on  = [google_cloudfunctions2_function.function_pixel_to_firestore]
}


