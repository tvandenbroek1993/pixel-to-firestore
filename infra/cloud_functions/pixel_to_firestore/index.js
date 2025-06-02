exports.main = (event, context) => {
  const message = event.data
    ? Buffer.from(event.data, 'base64').toString()
    : null;

  if (!message) {
    console.error('No message found in event data.');
    return;
  }

  try {
    const logEvent = JSON.parse(message);
    const payload = logEvent.jsonPayload || logEvent;

    const userId = payload.pixel_user_id;
    const sessionId = payload.pixel_session_id;
    const pageUrl = payload.event_body?.context?.page?.url;

    console.log('User ID:', userId);
    console.log('Session ID:', sessionId);
    console.log('Page URL:', pageUrl);
  } catch (error) {
    console.error('Failed to parse or extract data:', error);
    console.log('Raw message:', message);
  }
};
