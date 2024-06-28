const call = window.Daily.createFrame({
  showLeaveButton: true,
  iframeStyle: {
      position: 'fixed',
      width: '50%',
      height: '80%',
      top: '0',
      left: '0%',
      border: 'none',
      zIndex: '9999'
  }
});

call.join({ url: 'https://consultadeleke.daily.co/Oc7kMgFXsxGIlLxL0Uba' })
  .catch(error => {
      console.error('Failed to join room:', error);
      // Handle error, e.g., display error message to the user
  });
