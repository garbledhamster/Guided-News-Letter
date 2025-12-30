:root {
  --shadow-soft: 0 1px 0 rgba(0, 0, 0, 0.06), 0 10px 30px rgba(0, 0, 0, 0.08);
}

* {
  box-sizing: border-box;
}

::selection {
  background: rgba(99, 102, 241, 0.25);
}

html,
body {
  height: 100%;
}

body[data-focus="true"] #sidebar {
  display: none;
}

body[data-focus="true"] #mainWrap {
  grid-template-columns: 1fr;
}

body[data-focus="true"] #contentCard {
  border-radius: 0;
  border-left: 0;
  border-right: 0;
}

.scroll-soft::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}

.scroll-soft::-webkit-scrollbar-thumb {
  background: rgba(161, 161, 170, 0.5);
  border-radius: 999px;
}

.dark .scroll-soft::-webkit-scrollbar-thumb {
  background: rgba(113, 113, 122, 0.55);
}
