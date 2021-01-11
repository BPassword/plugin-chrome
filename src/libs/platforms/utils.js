export const getExtensionUrl = (part) => chrome.runtime.getURL(part);
export const getExtId = () => chrome.runtime.id;

export const getExtName = () => {
  return process.env.APP_NAME || 'BP';
};

export const stopPasswordSaving = () => {
  if (chrome && chrome.privacy) {
    chrome.privacy.services.passwordSavingEnabled.set({ scope: 'regular', value: false });
  }
};
