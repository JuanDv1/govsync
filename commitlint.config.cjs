module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [2, "never", ["upper-case"]],
    "header-max-length": [2, "always", 72],
  },
};
