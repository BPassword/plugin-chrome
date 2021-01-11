/*********************************************************************
 * AircraftClass ::
 *    @description:
 *    @description:
 * WARNINGS:
 *
 * HISTORY:
 *    @author: lanbery@gmail.com
 *    @created:  2020-12-04
 *    @comments:
 **********************************************************************/
export const CNST_PATH = {
  jetCss: 'share/css/injet.css',
  subJet: 'inpage/sub-injet.js',
  topJet: 'inpage/top-injet.js',
  leechPath: 'leech/leech.html',
  leechAddorPath: 'leech/leech.html#/add_passbook',
};

const excludeDomains = ['remix.ethereum.org'];

export function shouldActivedJet() {
  const domain = window.location.hostname || '';
  return doctypeCheck() && suffixCheck() && documentElementCheck() && !blockedDomainCheck(domain);
}

/** +++++++++++++++++++++++++++++++++++++++ Internal Functions +++++++++++++++++++++++++++++++++++++++++++++ */
function doctypeCheck() {
  const { doctype } = window.document;
  if (doctype) {
    return doctype.name === 'html';
  }
  return true;
}

function suffixCheck() {
  const prohibitedTypes = [/\.xml$/u, /\.pdf$/u];
  const currentUrl = window.location.pathname;
  for (let i = 0; i < prohibitedTypes.length; i++) {
    if (prohibitedTypes[i].test(currentUrl)) {
      return false;
    }
  }
  return true;
}

function documentElementCheck() {
  const documentElement = document.documentElement.nodeName;
  if (documentElement) {
    return documentElement.toLowerCase() === 'html';
  }
  return true;
}

function blockedDomainCheck(domain) {
  let index = excludeDomains.findIndex((d) => d === domain.toLowerCase());
  return index >= 0;
}
