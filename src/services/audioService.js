export const playAudioFile = (className) => {
    const audioFile = `/voice_predictions/${className}.mp3`;
    fetch(audioFile)
      .then(response => {
        if (!response.ok) {
          throw new Error('Audio file is corrupted or does not exist.');
        }
        return response.blob();
      })
      .then(blob => {
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play().catch(error => {
          console.error("Error playing audio:", error);
        });
      })
      .catch(error => {
        console.error("Failed to load audio file:", error);
      });
  };
  
  export const dataURLtoFile = (dataurl, filename) => {
    if (!dataurl) {
      throw new Error("Data URL is null");
    }
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };
  