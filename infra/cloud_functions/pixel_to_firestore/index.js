import * as functions from 'firebase-functions';
const admin = require('firebase-admin');

admin.initializeApp();

exports.insertFromPubsub = functions.pubsub
  .topic('environmental-sensors') // replace with your actual topic name
  .onPublish((message, context) => {
    console.log('The function was triggered at', context.timestamp);

    const messageBody = message.data
      ? Buffer.from(message.data, 'base64').toString()
      : null;

    if (!messageBody) {
      console.error('No message body found.');
      return;
    }

    try {
      const parsed = JSON.parse(messageBody);
      const payload = parsed.jsonPayload || parsed;

      const userId = payload.pixel_user_id;
      const sessionId = payload.pixel_session_id;

      const host = payload.location?.host;
      const path = payload.location?.path;
      const url = host && path ? `https://${host}${path}` : null;

      console.log('User ID:', userId);
      console.log('Session ID:', sessionId);
      console.log('Full Page URL:', url);
    } catch (error) {
      console.error('Failed to parse message:', error);
      console.log('Raw message content:', messageBody);
    }
  });
