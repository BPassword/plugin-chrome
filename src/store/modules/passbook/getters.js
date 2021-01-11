/*********************************************************************
 * AircraftClass :: Passbook
 *		@description: Migeration blockchain features from firefox
 *		@description:
 * WARNINGS:
 *
 * HISTORY:
 *		@author: lanbery@gmail.com
 *		@created:  2020-10-29
 *		@comments:
 **********************************************************************/
export const webdiff = (state) => {
  const Plain = state.webPlain;
  return diffCalcPlain(Plain);
};

export const mobdiff = (state) => {
  const Plain = state.mobPlain;
  return diffCalcPlain(Plain);
};

/**
 *
 * @param {Array} state []
 */
export const webItemsState = (state) => {
  return state.webItems;
};

export const mobItemsState = (state) => {
  return state.mobItems;
};

export const websiteCommitItems = (state) => {
  if (!state.webPlain || !state.webPlain.Commit) {
    return [];
  }
  return state.webPlain.Commit.map((it) => {
    it.title = it.Term.title;
    return it;
  });
};

export const mobileCommitItems = (state) => {
  return state.mobPlain.Commit.map((it) => {
    it.title = it.Term.title;
    return it;
  });
};

/*--------------------------- Private functions ----------------------------- */
/**
 *
 * @param {object} Plain
 */
function diffCalcPlain(Plain) {
  if (!Plain || !Plain.Commit || !Array.isArray(Plain.Commit) || !Plain.Commit.length) {
    return '';
  }
  let add = 0,
    del = 0,
    edit = 0;
  Plain.Commit.forEach((c) => {
    if (c.CType == 1) {
      add += 1;
    }
    if (c.CType == 2) {
      del += 1;
    }
    if (c.CType == 3) {
      edit += 1;
    }
  });

  if (add > 0) return `+${add}`;
  if (del > 0) return `-${del}`;
  if (edit > 0) return edit.toString();
}
