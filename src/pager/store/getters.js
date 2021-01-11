export const currentMatched = (state) => {
  const name = state.feildVolume.username;

  if (!name) return null;

  const items = state.items || [];

  const findItem = items.find((item) => item.username === name.toString().trim());

  return findItem || null;
};
