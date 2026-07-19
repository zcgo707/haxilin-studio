const menu = document.querySelector(".menu");
const navLinks = document.querySelector(".nav-links");

if (menu && navLinks) {
  const openMenu = () => {
    navLinks.classList.add("open");
    menu.setAttribute("aria-expanded", "true");
  };

  const closeMenu = () => {
    navLinks.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
  };

  const toggleMenu = () => {
    if (navLinks.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  // 菜单按钮点击切换
  menu.addEventListener("click", toggleMenu);

  // 点击导航链接后关闭菜单
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // 点击菜单外部关闭
  document.addEventListener("click", (e) => {
    if (
      navLinks.classList.contains("open") &&
      !navLinks.contains(e.target) &&
      !menu.contains(e.target)
    ) {
      closeMenu();
    }
  });

  // Escape 键关闭菜单并返回焦点
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navLinks.classList.contains("open")) {
      closeMenu();
      menu.focus();
    }
  });
}
