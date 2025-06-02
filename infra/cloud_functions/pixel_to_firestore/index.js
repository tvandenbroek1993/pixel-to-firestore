exports.main = (event, context) => {
  const message = event.data
    ? Buffer.from(event.data, 'base64').toString()
    : 'Hello, World';

  try {
    const parsed = JSON.parse(message);

    const userId = parsed.pixel_user_id;
    const sessionId = parsed.pixel_session_id;
    const pageUrl = parsed.event_body?.context?.page?.url;

    console.log('User ID:', userId);
    console.log('Session ID:', sessionId);
    console.log('Page URL:', pageUrl);
  } catch (error) {
    console.error('Failed to parse message or log fields:', error);
    console.log('Raw message:', message);
  }
};