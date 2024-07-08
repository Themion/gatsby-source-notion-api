import { Client } from '@notionhq/client';
import { isPageAccessible } from '../utils';

type UpdatePageOption = {
  token: string;
  notionVersion: string;
  pageId: string;
  key: string;
  value: string;
};

export const updatePage = async ({
  token,
  notionVersion,
  pageId,
  key,
  value,
}: UpdatePageOption) => {
  const notion = new Client({ auth: token, notionVersion });

  try {
    const result = await notion.pages.update({
      page_id: pageId,
      properties: {
        [key]: {
          type: 'rich_text',
          rich_text: [
            {
              type: 'text',
              text: {
                content: value,
                link: null,
              },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default',
              },
            },
          ],
        },
      },
    });

    return isPageAccessible(result) ? result.properties[key] : null;
  } catch {
    return null;
  }
};
