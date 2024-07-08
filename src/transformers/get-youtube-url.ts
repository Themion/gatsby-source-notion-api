// https://stackoverflow.com/questions/19377262/regex-for-youtube-url
const youtubeRegex =
  /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(?:-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)(?<youtubeId>[\w\-]+)(\S+)?$/;
export const getYoutubeUrl = (url: string) => {
  const capturedGroups = youtubeRegex.exec(url)?.groups;
  if (capturedGroups === undefined) return null;
  return `https:///www.youtube.com/embed/${capturedGroups['youtubeId']}`;
};
