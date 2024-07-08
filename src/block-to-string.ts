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
const annotateLink = ifTrue(pick('link'), ({ content, link, ...data }) => ({
  ...data,
  link,
  content: `<a href="${link?.url ?? ''}">${content}</a>`,
}));

const stylize = pipe(
  annotateEquation,
  annotateCode,
  annotateBold,
  annotateItalic,
  annotateUnderline,
  annotateStrikethrough,
  annotateColor,
  annotateLink,
);

export const blockToString = (textBlocks: RichTextItemResponse[]): string =>
  textBlocks.reduce((text, textBlock) => {
    const data: TextInfo = {
      ...textBlock.annotations,
      equation: textBlock.type === 'equation',
      link: textBlock.type === 'text' ? textBlock.text.link : null,
      content: textBlock.plain_text,
    };

    if (textBlock.type == 'equation') {
      data.content = textBlock.equation.expression;
    }

    if (textBlock.type == 'mention') {
      if (textBlock.mention.type == 'user') {
        data.content = textBlock.plain_text;
      }

      if (textBlock.mention.type == 'date') {
        if (textBlock.mention.date.end) {
          data.content = `${textBlock.mention.date.start} → ${textBlock.mention.date.end}`;
        } else {
          data.content = textBlock.mention.date.start;
        }

        data.content = `<time datetime="${data.content}">${data.content}</time>`;
      }

      if (textBlock.mention.type == 'page') {
        data.content = textBlock.plain_text;
      }
    }

    return text.concat(stylize(data).content);
  }, '');
