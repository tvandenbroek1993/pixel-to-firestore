// Import the Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK.
// In many Google Cloud Functions environments (Node.js 10+),
// admin.initializeApp() without arguments works if the function has permissions.
// The try-catch handles cases where it might be initialized elsewhere or in older environments.
try {
  if (admin.apps.length === 0) { // Initialize only if no apps are already initialized
    admin.initializeApp();
  }
} catch (e) {
  console.warn('Firebase Admin SDK initialization issue:', e.message); // Use warn for non-critical init issues
}

const firestore = admin.firestore();

/**
 * Processes an event message to extract user and URL data,
 * then stores the URL in a Firestore collection named after the user ID.
 *
 * @param {object} event The event payload.
 * @param {object} context The event metadata.
 */
exports.main = async (event, context) => { // Made function async for Firestore operations
  const message = event.data
    ? Buffer.from(event.data, 'base64').toString()
    : null;

  if (!message) {
    console.error('Error: No message found in event data.');
    return; // Exit if no message
  }

  let payload;
  try {
    const outer = JSON.parse(message);
    payload = outer.jsonPayload || outer; // Handle different possible payload structures
  } catch (error) {
    console.error('Error: Failed to parse JSON message:', error);
    console.log('Raw message content:', message);
    return; // Exit if parsing fails
  }

  const userId = payload.pixel_user_id;
  const sessionId = payload.pixel_session_id; // Extracted, can be used if needed later

  const host = payload.location?.host;
  const path = payload.location?.path;
  const url = host && path ? host + path : null;

  // Log extracted information
  console.log(`Processing data: User ID: ${userId}, Session ID: ${sessionId}, URL: ${url}`);

  // Validate essential data for Firestore operation
  if (!userId || typeof userId !== 'string' || userId.trim() === '' || userId.includes('/')) {
    console.error(`Error: Invalid or missing User ID ('${userId}'). Cannot store URL in Firestore. User ID must be a non-empty string without slashes.`);
    return;
  }

  if (!url || typeof url !== 'string' || url.trim() === '') {
    console.log('Info: URL is missing or empty. Nothing to store in Firestore.');
    return;
  }

  try {
    // Use userId as the Collection ID.
    // A specific document (e.g., 'userUrlData') within this collection will store the array of URLs.
    const userCollectionRef = firestore.collection(userId);
    const urlsDocumentRef = userCollectionRef.doc('userUrlData'); // Document ID to store URL array

    // Atomically add the new URL to the 'urls' array in the document.
    // 'merge: true' ensures that other fields in the document are not overwritten.
    // 'FieldValue.arrayUnion()' adds the URL only if it's not already present.
    await urlsDocumentRef.set({
      urls: admin.firestore.FieldValue.arrayUnion(url),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp() // Optional: track last update
    }, { merge: true });

    console.log(`Successfully stored/updated URL ('${url}') for User ID '${userId}' in Firestore collection '${userId}', document 'userUrlData'.`);

  } catch (firestoreError) {
    console.error(`Error: Failed to write URL to Firestore for User ID '${userId}'. Details:`, firestoreError);
    // Depending on requirements, you might want to re-throw the error or handle it differently
  }
};