# HeadlessCMS
### A lightweight, flat file, headless CMS

***In development***

- Simple HTTP API for reading content
- Flat files - no database. Commit it all to git for content revisions
- frontmatter format
- Access policies
  - Read all content
  - Read only published content
  - No access
- Markdown, HTML, or structured data (yaml or json)
- Zero-config - works out of the box with sane defaults
- Multiple website support (identified by either API token, hostname, or URL path)

## Usage

Resources (your content) lives in `sitedata/`. All files are in frontmatter format. `sitedata/.config/` contains general configuration for your site including the access policies.

Dotfiles (files and folders that start with a period `.`) are ignored and never served.

#### Reading resources

- `http://localhost:3000/home` will return the resource `sitedata/home.md`. 
- `http://localhost:3000/books/harry-potter` will return the resource `sitedata/books/harry-potter.md`.
- `http://localhost:3000/_api/get?paths=books/harry-potter,books/war-of-the-worlds` will return both the resources `sitedata/books/harry-potter.md` and `sitedata/books/war-of-the-worlds.md`.

#### Searching / listing resources
You can search resources via `http://localhost:3000/_api/search`.

Search options are added to the query string of the search URL, eg. `http://localhost:3000/_api/search?tags=blog`.

- **path**
  The path to search in. By default it will search everything in your sitedata folder.
- **tags**
  To search for all resources with the `blog` tag, use `tags=blog`. Multiple tags maye be given via `tags=blog,development`
- **include**
  By default the search results will only include basic information about the resource. Use the `include` option to include more. Eg. `include=tags,body`. Available options:
  - tags
  - body
- **pathdepth**
  How deep to search folders. 0 = unlimited. Defaults to 5.
