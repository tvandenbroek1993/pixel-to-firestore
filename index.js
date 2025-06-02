const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue } = require('@google-cloud/firestore'); // Import FieldValue

// Initialize Firestore client
const firestore = new Firestore();

functions.cloudEvent('logUserPageview', async (cloudEvent) => {
  const base64data = cloudEvent.data.message.data;
  const eventDataString = Buffer.from(base64data, 'base64').toString('utf-8');

  try {
    const parsedEvent = JSON.parse(eventDataString);
    const eventPayload = parsedEvent.jsonPayload;

    if (!eventPayload) {
      console.error('Error: jsonPayload not found in the message.');
      return; // Acknowledge to prevent retries for this malformed message
    }

    console.log('Received event payload for pageview logging:', eventPayload);

    // --- 1. Determine User ID ---
    const pixelUserId = eventPayload.pixel_user_id;
    const rawUserId = eventPayload.user_id;
    const finalUserId = String(rawUserId || pixelUserId || '').trim();

    if (!finalUserId) {
      console.error('Error: Valid user_id or pixel_user_id is missing. Cannot process event.');
      return; // Acknowledge
    }

    // --- 2. Extract page URL components ---
    const location = eventPayload.location || {};
    const protocol = String(location.protocol || '').trim();
    const host = String(location.host || '').trim();
    const path = String(location.path || '').trim(); // Path can be "/" or empty for root

    if (!protocol || !host) {
      console.error(`Error: Protocol or host missing from location for user ${finalUserId}. Cannot construct page URL.`);
      return; // Acknowledge
    }

    const pageUrl = `${protocol}//${host}${path}`; // e.g., "https://example.com/some/page"

    if (!pageUrl.startsWith('http://') && !pageUrl.startsWith('https://')) {
        console.error(`Error: Constructed page URL "${pageUrl}" is invalid for user ${finalUserId}.`);
        return; // Acknowledge
    }

    // --- 3. Get reference to the user's document ---
    // Collection e.g., 'userPageHistories'. Document ID is the finalUserId.
    const userDocRef = firestore.collection('userPageHistories').doc(finalUserId);

    // --- 4. Update the document ---
    // Add the pageUrl to an array named 'visitedPageUrls'.
    // FieldValue.arrayUnion ensures the URL is added only if it's not already present.
    // Also, update a 'lastVisited' timestamp and 'lastPageVisited'.
    await userDocRef.set({
      visitedPageUrls: FieldValue.arrayUnion(pageUrl),
      lastActivityTimestamp: FieldValue.serverTimestamp(),
      // Optionally store some other user-level attributes if they are static or first-time
      // For example, if you want to store the user_agent on first sight:
      // userAgent: eventPayload.user_agent (this would need logic to set only once or if changed)
    }, { merge: true }); // merge:true creates the document if it doesn't exist,
                         // or updates it if it does, without overwriting other fields
                         // not specified in this .set() call (unless they are part of arrayUnion).

    console.log(`Page URL "${pageUrl}" added for user_id "${finalUserId}".`);

  } catch (error) {
    console.error(`Error processing message for user or writing to Firestore (user_id: ${eventPayload?.user_id || eventPayload?.pixel_user_id || 'unknown'}):`, error);
    // Re-throw to allow Pub/Sub retries for transient errors.
    throw error;
  }
});