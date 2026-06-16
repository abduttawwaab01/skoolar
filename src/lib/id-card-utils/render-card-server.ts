import { renderIDCardHTML, RenderCardOptions } from './render-card-html';

export async function renderIDCard(
  person: any,
  options: RenderCardOptions
): Promise<Buffer> {
  return renderIDCardHTML(person, options);
}
