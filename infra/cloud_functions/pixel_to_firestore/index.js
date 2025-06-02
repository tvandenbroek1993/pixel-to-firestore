exports.main = (event, context) => {
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
  } catch (error) {
    console.error('Failed to parse or extract data:', error);
    console.log('Raw message content:', message);
  }
};
