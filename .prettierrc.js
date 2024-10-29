// pre-commit won't find the plugin with any other format of the prettierrc file
module.exports = {
  plugins: [require.resolve("prettier-plugin-jinja-template")],
  overrides: [
    {
      files: ["*.html"],
      options: {
        parser: "jinja-template",
        printWidth: 120,
        bracketSameLine: true,
      },
    },
    {
      files: ["*.md"],
      options: {
        // Didn't find a way to make printWidth apply to code blocks inside md files
        embeddedLanguageFormatting: "off",
      },
    },
  ],
};
