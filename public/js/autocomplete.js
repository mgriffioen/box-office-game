// Accessible combobox: attaches a suggestion list under a text input.
// source(query) returns (or resolves to) [{ label, detail?, value? }].
// onPick(item) runs when a suggestion is chosen by click or Enter.
let nextId = 0;

export function attachAutocomplete(input, { source, onPick, minLength = 1 }) {
  const list = document.createElement('ul');
  list.className = 'suggestions';
  list.id = `suggestions-${nextId++}`;
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  input.after(list);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');

  let items = [];
  let active = -1;
  let requestId = 0;

  function close() {
    list.hidden = true;
    items = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function render() {
    list.replaceChildren(
      ...items.map((item, i) => {
        const li = document.createElement('li');
        li.id = `${list.id}-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(i === active));
        li.textContent = item.label;
        if (item.detail) {
          const span = document.createElement('span');
          span.className = 'detail';
          span.textContent = item.detail;
          li.append(span);
        }
        // mousedown so the pick lands before the input loses focus.
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          pick(i);
        });
        return li;
      }),
    );
    list.hidden = items.length === 0;
    input.setAttribute('aria-expanded', String(!list.hidden));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function pick(i) {
    const item = items[i];
    close();
    input.value = item.label;
    onPick(item);
  }

  input.addEventListener('input', async () => {
    const query = input.value.trim();
    const id = ++requestId;
    if (query.length < minLength) return close();
    const results = await source(query);
    if (id !== requestId) return; // a newer keystroke won
    items = results;
    active = -1;
    render();
  });

  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + items.length + 1) % (items.length + 1);
      if (active === items.length) active = -1;
      render();
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape') {
      close();
    }
  });

  input.addEventListener('blur', close);
  return { close };
}
