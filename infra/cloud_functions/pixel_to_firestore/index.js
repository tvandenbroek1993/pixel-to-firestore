const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore');

const firestore = new Firestore();

functions.cloudEvent('main', async (cloudEvent) => {
  // 1. Get the base64-encoded data from the Pub/Sub message
  const base64data = cloudEvent.data.message.data;

  if (!base64data) {
    console.error('Error: No data found in Pub/Sub message.');
    return; // Acknowledge the message to prevent retries for this malformed event
  }

  const eventDataString = Buffer.from(base64data, 'base64').toString('utf-8');
  let eventPayload;

  try {
    // 2. Parse the event data string to get the payload
    // Assuming the Pub/Sub message's data is a JSON string
    // which itself contains a 'jsonPayload' field, as in your initial setup.
    // If the Pub/Sub message data *is* the JSON payload directly, adjust accordingly.
    const parsedMessage = JSON.parse(eventDataString);
    eventPayload = parsedMessage.jsonPayload; // Or simply: eventPayload = JSON.parse(eventDataString); if the structure is flatter

    if (!eventPayload) {
      console.error('Error: jsonPayload not found in the parsed message from Pub/Sub.');
      return; // Acknowledge
    }

    console.log('Received event payload for pageview logging:', eventPayload);

    // --- Determine User ID ---
    const pixelUserId = eventPayload.pixel_user_id;
    const rawUserId = eventPayload.user_id;
    const finalUserId = String(rawUserId || pixelUserId || '').trim();

    if (!finalUserId) {
      console.error('Error: Valid user_id or pixel_user_id is missing. Cannot process event.');
      return; // Acknowledge
    }

    // --- Extract page URL components ---
    const location = eventPayload.location || {};
    const protocol = String(location.protocol || '').trim();
    const host = String(location.host || '').trim();
    const path = String(location.path || '').trim();

    if (!protocol || !host) {
      console.error(`Error: Protocol or host missing from location for user ${finalUserId}. Cannot construct page URL.`);
      return; // Acknowledge
    }

    const pageUrl = `${protocol}//${host}${path}`;

    if (!pageUrl.startsWith('http://') && !pageUrl.startsWith('https://')) {
        console.error(`Error: Constructed page URL "${pageUrl}" is invalid for user ${finalUserId}.`);
        return; // Acknowledge
    }

    // --- Get reference to the user's document ---
    const userDocRef = firestore.collection('userPageHistories').doc(finalUserId);

    // --- Update the document ---
    await userDocRef.set({
      visitedPageUrls: FieldValue.arrayUnion(pageUrl),
      lastActivityTimestamp: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`Page URL "${pageUrl}" added for user_id "${finalUserId}".`);
    // For successful completion, just return or let the async function resolve.
    return;

  } catch (error) {
    // Log the error. If you want Pub/Sub to retry, throw the error.
    // If it's an error in parsing or a bad message format that won't be fixed by a retry,
    // you might just log and return to acknowledge the message.
    const userIdForErrorLog = eventPayload?.user_id || eventPayload?.pixel_user_id || 'unknown (payload parsing might have failed)';
    console.error(`Error processing Pub/Sub message for user or writing to Firestore (user_id: ${userIdForErrorLog}):`, error);

    // If the error is something like a temporary Firestore issue, re-throw to allow retries.
    // If it's a data validation error or JSON parsing error, just returning (as done in specific checks above)
    // acknowledges the message and prevents infinite retries on bad data.
    // For a general catch-all, re-throwing is often the default if retries are desired for transient issues.
    throw error;
  }
});