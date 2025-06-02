/**
 * Google Cloud Function to process log events.
 * Extracts user ID, session ID, and a cleaned page URL (without query parameters).
 *
 * @param {object} event The event payload.
 * @param {object} context The event metadata.
 */
exports.main = (event, context) => {
  // Decode the incoming message data from base64
  const message = event.data
    ? Buffer.from(event.data, 'base64').toString()
    : null;

  // If no message is found, log an error and exit
  if (!message) {
    console.error('No message found in event data.');
    return;
  }

  try {
    // Parse the JSON message
    const logEvent = JSON.parse(message);
    // Determine the main payload object.
    // User confirmed this line works for userId and sessionId, so we assume 'payload'
    // correctly points to the object containing pixel_user_id, pixel_session_id, and event_body.
    const payload = logEvent.jsonPayload || logEvent;

    // Extract user ID and session ID
    const userId = payload.pixel_user_id;
    const sessionId = payload.pixel_session_id;

    // Extract the raw page URL using the corrected path
    // The sample JSON shows page_url directly under context: payload.event_body.context.page_url
    const rawPageUrl = payload.event_body?.context?.page_url;

    // Log the extracted user ID and session ID
    console.log('User ID:', userId);
    console.log('Session ID:', sessionId);

    // Process and log the page URL
    if (rawPageUrl) {
      console.log('Raw Page URL extracted:', rawPageUrl);
      try {
        // Ensure rawPageUrl is a non-empty string before attempting to parse
        if (typeof rawPageUrl === 'string' && rawPageUrl.trim().length > 0) {
          const urlObject = new URL(rawPageUrl);
          // Construct the cleaned URL (protocol + host + pathname)
          const cleanedPageUrl = `${urlObject.protocol}//${urlObject.host}${urlObject.pathname}`;
          console.log('Page URL (Cleaned):', cleanedPageUrl);
        } else {
          console.log('Page URL: Raw URL is not a valid string or is empty. Value:', rawPageUrl);
        }
      } catch (urlParseError) {
        // Handle errors during URL parsing (e.g., if rawPageUrl is malformed)
        console.error('Failed to parse Page URL:', urlParseError.message);
        // Log the raw URL if parsing fails, so data isn't completely lost
        console.log('Page URL (Unparseable, using raw):', rawPageUrl);
      }
    } else {
      // Log if the page URL was not found at the expected path
      console.log('Page URL: Not found at payload.event_body.context.page_url');
      // For deeper debugging, you might want to inspect parts of the payload:
      // console.log('Debug: payload.event_body:', payload.event_body);
      // if (payload.event_body) {
      //   console.log('Debug: payload.event_body.context:', payload.event_body.context);
      // }
    }
  } catch (error) {
    // Handle errors during JSON parsing or other unexpected issues
    console.error('Failed to parse or extract data:', error);
    // Log the raw message for debugging purposes if parsing/extraction fails
    console.log('Raw message content:', message);
  }
};