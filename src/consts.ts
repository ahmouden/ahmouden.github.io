import type { Site, Page, Links, Socials } from "@types"

// Global
export const SITE: Site = {
  TITLE: "Ahmed's Portfolio",
  DESCRIPTION: "Welcome to Ahmed EL-MOUDEN's blog and portfolio.",
  AUTHOR: "ahmouden",
}

// Work Page
export const WORK: Page = {
  TITLE: "Work",
  DESCRIPTION: "Places I have worked.",
}

// Blog Page
export const BLOG: Page = {
  TITLE: "Blog",
  DESCRIPTION: "Writing on topics I am passionate about.",
}

// Projects Page 
export const PROJECTS: Page = {
  TITLE: "Projects",
  DESCRIPTION: "Recent projects I have worked on.",
}

// Search Page
export const SEARCH: Page = {
  TITLE: "Search",
  DESCRIPTION: "Search all posts and projects by keyword.",
}

// Links
export const LINKS: Links = [
  { 
    TEXT: "Home", 
    HREF: "/", 
  },
  { 
    TEXT: "Work", 
    HREF: "/work", 
  },
  { 
    TEXT: "Blog", 
    HREF: "/blog", 
  },
  { 
    TEXT: "Projects", 
    HREF: "/projects", 
  },
]

// Socials
export const SOCIALS: Socials = [
  { 
    NAME: "Email",
    ICON: "email", 
    TEXT: "ahmouden@proton.me",
    HREF: "mailto:ahmouden@proton.me",
  },
  { 
    NAME: "Github",
    ICON: "github",
    TEXT: "ahmouden",
    HREF: "https://github.com/ahmouden"
  },
  { 
    NAME: "LinkedIn",
    ICON: "linkedin",
    TEXT: "ahmed-elmouden",
    HREF: "https://www.linkedin.com/in/ahmed-elmouden",
  },
  { 
    NAME: "Twitter",
    ICON: "twitter-x",
    TEXT: "ahmouden",
    HREF: "https://twitter.com/ahmouden",
  },
]

