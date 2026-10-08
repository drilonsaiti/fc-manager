/** Copies text; falls back to a selectable textarea on browsers that block the async clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    let el: HTMLTextAreaElement | null = null;
    try {
      el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.top = "0";
      el.style.left = "0";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus({ preventScroll: true });
      el.setSelectionRange(0, el.value.length);
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      el?.remove();
    }
  }
}
