import {
  RichTextItemResponse,
  TextRichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints';

type TextInfo = RichTextItemResponse['annotations'] & {
  equation: boolean;
  link: TextRichTextItemResponse['text']['link'];
  content: string;
};

type Func<T = TextInfo> = (data: TextInfo) => T;

const pipe =
  (...funcList: Func[]) =>
  (data: TextInfo) =>
    funcList.reduce((d, func) => func(d), data);

const pick = (key: keyof TextInfo) => (obj: TextInfo) => !!obj[key];

const ifTrue = (predicate: Func<boolean>, transformer: Func) => (data: TextInfo) =>
  predicate(data) ? transformer(data) : data;

const equationUrl = (content: string) =>
  `http://www.sciweavers.org/tex2img.php?eq=${encodeURIComponent(
    content,
  )}&bc=White&fc=Black&im=jpg&fs=20&ff=arev&edit=`;

const annotateEquation = ifTrue(pick('equation'), ({ content, ...data }) => ({
  ...data,
  content: `<img src="${equationUrl(content)}" alt="${content}"></img>`,
}));
const annotateLink = ifTrue(pick('link'), ({ content, link, ...data }) => ({
  ...data,
  link,
  content: `<a href="${link?.url ?? ''}">${content}</a>`,
}));
const annotateCode = ifTrue(pick('code'), ({ content, ...data }) => ({
  ...data,
  content: `<code>${content}</code>`,
}));
const annotateBold = ifTrue(pick('bold'), ({ content, ...data }) => ({
  ...data,
  content: `<strong>${content}</strong>`,
}));
const annotateItalic = ifTrue(pick('italic'), ({ content, ...data }) => ({
  ...data,
  content: `<em>${content}</em>`,
}));
const annotateUnderline = ifTrue(pick('underline'), ({ content, ...data }) => ({
  ...data,
  content: `<u>${content}</u>`,
}));
const annotateStrikethrough = ifTrue(pick('strikethrough'), ({ content, ...data }) => ({
  ...data,
  content: `<del>${content}</del>`,
}));
const annotateColor = ifTrue(
  ({ color }) => color != 'default',
  ({ content, color, ...data }) => ({
    ...data,
    color,
    content: `<span notion-color="${color}">${content}</span>`,
  }),
);

const stylize = pipe(
  annotateEquation,
  annotateLink,
  annotateCode,
  annotateBold,
  annotateItalic,
  annotateUnderline,
  annotateStrikethrough,
  annotateColor,
);

const timeTag = (dateString: string) => `<time datetime="${dateString}">${dateString}</time>`;

const getRichTextContent = (block: RichTextItemResponse): string => {
  switch (block.type) {
    case 'equation':
      return block.equation.expression.replaceAll('\n', '');
    case 'mention':
      if (block.mention.type === 'date') {
        const { start, end } = block.mention.date;
        return end !== null ? `${timeTag(start)} ~ ${timeTag(end)}` : timeTag(start);
      }
    default:
      return block.plain_text.replaceAll('\n', '<br>');
  }
};

const getRichTextHtml = (textBlock: RichTextItemResponse): string => {
  const data: TextInfo = {
    ...textBlock.annotations,
    equation: textBlock.type === 'equation',
    link: textBlock.type === 'text' ? textBlock.text.link : null,
    content: getRichTextContent(textBlock),
  };

  return stylize(data).content;
};

export const blockToString = (textBlocks: RichTextItemResponse[]): string =>
  textBlocks.map(getRichTextHtml).join('');
