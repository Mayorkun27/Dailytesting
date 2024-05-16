// Content-Security-Policy: frame-ancestors 'self' https://dashboard.daily.co/;

/**
 * Handles participant-joined and participant-updated events:
 * - Updates the participant count
 * - Creates a video container for new participants
 * - Creates an audio element for new participants
 * - Manages video and audio tracks based on their current state
 * - Updates device states for the local participant
 * @param {Object} event - The participant-joined, participant-updated
 * event object.
 */
function handleParticipantJoinedOrUpdated(event) {
    const { participant } = event;
    const participantId = participant.session_id;
    const isLocal = participant.local;
    const tracks = participant.tracks;
  
    // Always update the participant count regardless of the event action
    this.updateAndDisplayParticipantCount();
  
    // Create a video container if one doesn't exist
    if (!document.getElementById(`video-container-${participantId}`)) {
      this.createVideoContainer(participantId);
    }
  
    // Create an audio element for non-local participants if one doesn't exist
    if (!document.getElementById(`audio-${participantId}`) && !isLocal) {
      this.createAudioElement(participantId);
    }
  
    Object.entries(tracks).forEach(([trackType, trackInfo]) => {
      // If a persistentTrack exists...
      if (trackInfo.persistentTrack) {
        // Check if this is the local participant's audio track.
        // If so, we will skip playing it, as it's already being played.
        // We'll start or update tracks in all other cases.
        if (!(isLocal && trackType === 'audio')) {
          this.startOrUpdateTrack(trackType, trackInfo, participantId);
        }
      } else {
        // If the track is not available, remove the media element
        this.destroyTracks([trackType], participantId);
      }
  
      // Update the video UI based on the track's state
      if (trackType === 'video') {
        this.updateVideoUi(trackInfo, participantId);
      }
  
      // Update the camera and microphone states for the local user based on the track's state
      if (isLocal) {
        this.updateUiForDevicesState(trackType, trackInfo);
      }
    });
};


/**
 * Updates the media track (audio or video) source for a specific participant and plays
 * the updated track. It checks if the source track needs to be updated and performs the
 * update if necessary, ensuring playback of the media track.
 *
 * @param {string} trackType - Specifies the type of track to update ('audio' or 'video'),
 * allowing the function to dynamically adapt to the track being processed.
 * @param {Object} track - Contains the media track data, including the `persistentTrack`
 * property which holds the actual MediaStreamTrack to be played or updated.
 * @param {string} participantId - Identifies the participant whose media track is being
 * updated.
 */
function startOrUpdateTrack(trackType, track, participantId) {
    // Construct the selector string or ID based on the trackType.
    const selector =
      trackType === 'video'
        ? `#video-container-${participantId} video.video-element`
        : `audio-${participantId}`;
  
    // Retrieve the specific media element from the DOM.
    const trackEl =
      trackType === 'video'
        ? document.querySelector(selector)
        : document.getElementById(selector);
  
    // Error handling if the target media element does not exist.
    if (!trackEl) {
      console.error(
        `${trackType} element does not exist for participant: ${participantId}`
      );
      return;
    }
  
    // Check for the need to update the media source. This is determined by checking whether the
    // existing srcObject's tracks include the new persistentTrack. If there are no existing tracks
    // or the new track is not among them, an update is necessary.
    const existingTracks = trackEl.srcObject?.getTracks();
    const needsUpdate = !existingTracks?.includes(track.persistentTrack);
  
    // Perform the media source update if needed by setting the srcObject of the target element
    // to a new MediaStream containing the provided persistentTrack.
    if (needsUpdate) {
      trackEl.srcObject = new MediaStream([track.persistentTrack]);
  
      // Once the media metadata is loaded, attempts to play the track. Error handling for play
      // failures is included to catch and log issues such as autoplay policies blocking playback.
      trackEl.onloadedmetadata = () => {
        trackEl
          .play()
          .catch((e) =>
            console.error(
              `Error playing ${trackType} for participant ${participantId}:`,
              e
            )
          );
      };
    }
};

/**
 * Shows or hides the video element for a participant, including managing
 * the visibility of the video based on the track state.
 * @param {Object} track - The video track object.
 * @param {string} participantId - The ID of the participant.
 */
function updateVideoUi(track, participantId) {
    let videoEl = document
      .getElementById(`video-container-${participantId}`)
      .querySelector('video.video-element');
  
    switch (track.state) {
      case 'off':
      case 'interrupted':
      case 'blocked':
        videoEl.style.display = 'none'; // Hide video but keep container
        break;
      case 'playable':
      default:
        // Here we handle all other states the same as we handle 'playable'.
        // In your code, you may choose to handle them differently.
        videoEl.style.display = '';
        break;
    }
};

/**
 * Cleans up specified media track types (e.g., 'video', 'audio') for a given participant
 * by stopping the tracks and removing their corresponding elements from the DOM. This is
 * essential for properly managing resources when participants leave or change their track
 * states.
 * @param {Array} trackTypes - An array of track types to destroy, e.g., ['video', 'audio'].
 * @param {string} participantId - The ID of the participant.
 */
function destroyTracks(trackTypes, participantId) {
    trackTypes.forEach((trackType) => {
      const elementId = `${trackType}-${participantId}`;
      const element = document.getElementById(elementId);
      if (element) {
        element.srcObject = null; // Release media resources
        element.parentNode.removeChild(element); // Remove element from the DOM
      }
    });
};
  
/**
 * Toggles the local video track's mute state.
 */
function toggleCamera() {
    this.call.setLocalVideo(!this.call.localVideo());
}

/**
 * Toggles the local audio track's mute state.
 */
function toggleMicrophone() {
    this.call.setLocalAudio(!this.call.localAudio());
}

/**
 * Updates the UI to reflect the current states of the local participant's
 * camera and microphone.
 * @param {string} trackType - The type of track, either 'video' for cameras
 * or 'audio' for microphones.
 * @param {Object} trackInfo - The track object.
 */
function updateUiForDevicesState(trackType, trackInfo) {
    // For video, set the camera state
    if (trackType === 'video') {
      document.getElementById('camera-state').textContent = `Camera: ${
        this.call.localVideo() ? 'On' : 'Off'
      }`;
    } else if (trackType === 'audio') {
      // For audio, set the mic state
      document.getElementById('mic-state').textContent = `Mic: ${
        this.call.localAudio() ? 'On' : 'Off'
      }`;
    }
}

/**
 * Leaves the call and performs necessary cleanup operations like removing video elements.
 */
async function leave() {
    try {
      await this.call.leave();
      document.querySelectorAll('#videos video, audio').forEach((el) => {
        el.srcObject = null; // Release media resources
        el.remove(); // Remove the element from the DOM
      });
    } catch (e) {
      console.error('Leaving failed', e);
    }
}
  
  
  
  