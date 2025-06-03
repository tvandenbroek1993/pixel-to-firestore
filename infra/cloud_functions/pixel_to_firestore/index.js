exports.main = async (event, context) => {
  const message = event.data
    ? Buffer.from(event.data, 'base64').toString()
    : null;

  if (!message) {
    console.error('No message found in event data.');
    return;
  }

  try {
    const outer = JSON.parse(message);
    const payload = outer.jsonPayload || outer;

    const userId = payload.pixel_user_id;
    const sessionId = payload.pixel_session_id;

    const host = payload.location?.host;
    const path = payload.location?.path;
    const url = host && path ? host + path : null;

    console.log('User ID:', userId);
    console.log('Session ID:', sessionId);
    console.log('Raw Page URL:', url);

//    const admin = require('firebase-admin');
//
//    // Initialize only if not already initialized (important for re-used functions)
//    if (!admin.apps.length) {
//      admin.initializeApp();
//    }
//
//    const firestore = admin.firestore();
//
//    // Create collection ID by concatenating userId and sessionId
//    const collectionId = `${userId}_${sessionId}`;
//
//    // Reference to a document inside this collection
//    // For example, a fixed doc ID "sessionData" to hold the URLs array
//    const docRef = firestore.collection(collectionId).doc('sessionData');
//
//    // Update the document: add URL to 'urls' array if URL exists
//    if (url) {
//      await docRef.set(
//        {
//          urls: admin.firestore.FieldValue.arrayUnion(url),
//        },
//        { merge: true }
//      );
//      console.log('URL added to Firestore array');
//    } else {
//      console.log('No valid URL found, skipping Firestore update');
//    }
  } catch (error) {
    console.error('Failed to parse or extract data:', error);
    console.log('Raw message content:', message);
  }
};
