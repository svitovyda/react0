/**
 * Returns array of keys for object, empty array if object is not defined
 * @param obj
 * @returns array of strings
 */
const keys = (obj) => (obj ? Object.keys(obj) : []);

/**
 * Simple function to sort strings in array
 * @param str1
 * @param str2
 * @returns one of 1, 0, -1
 */
const sortStrings = (str1, str2) => {
  if (str1 > str2) return 1;
  if (str2 > str1) return -1;
  return 0;
};

/**
 * Adds error into the given errors container
 * If there is already error for given package, it will add new error
 * @param errors - container for reporting errors in the end, format:
 * array of objects key: string, value - array of string error messages
 * @param key - package name
 * @param value - usually some error description
 */
const addError = (errors, key, value) => {
  errors[key] = errors[key] ? [...errors[key], value] : [value];
};

/**
 * Adds duplicate error into the given duplicates container. This is the
 * specific error when one same dependency is used in the project with
 * different versions.
 * @param duplicates - container for reporting duplicating errors in the
 * end, format: array of objects key: string, value - array of string
 * containing version and package name if was possible to identify it
 * @param key - package name
 * @param value - usually version and package name (if was possible to
 * identify it)
 */
const addDuplicate = (duplicates, key, value) => {
  duplicates[key] = duplicates[key] ? [...duplicates[key], value] : [value];
};

/**
 * Goes through all package dependencies and identifies duplicated
 * dependencies
 * @param devDeps - list of all dev dependencies
 * @param deps - list of all direct dep
 * @returns {*[]}
 */
const findDuplicates = (devDeps, deps) => {
  const result = [];
  if (!devDeps || !deps) return result;

  keys(devDeps).forEach((key) => {
    if (deps[key]) result.push(key);
  });
  return result;
};

/**
 * Checks dependency on simple errors: if not fixed version, if `@types` is
 * not a devDependency, adds error into the error container
 * @param errors - container for reporting errors in the end, format:
 * array of objects key: string, value - array of string error messages
 * @param version
 * @param name
 * @param packageName
 * @param isDirect
 */
const checkForErrors = (errors, version, name, packageName, isDirect = false) => {
  if (version.startsWith("^")) {
    addError(errors, name, `v${version} in ${packageName} should be fixed`);
  }
  if (isDirect && name.startsWith("@types/")) {
    addError(errors, name, `v${version} in ${packageName} should be in devDependencies`);
  }
};

/**
 * Adds minimal description of the dependency into the given container,
 * checks on errors first and excludes `selfapy` packages
 * @param allDeps - container of all used in project dependencies in a
 * simple format: key: name, value:
 * { version, isDirectDependency, isDevDependency }
 * @param errors - container for reporting errors in the end, format:
 * array of objects key: string, value - array of string error messages
 * @param duplicates - container for reporting duplicating errors in the
 * end, format: array of objects key: string, value - array of string
 * containing version and package name if was possible to identify it
 * @param version
 * @param name
 * @param packageName
 * @param isDirect
 */
const addDependency = (allDeps, errors, duplicates, version, name, packageName, isDirect = false) => {
  if (!/selfapy/.test(name)) {
    checkForErrors(errors, version, name, packageName, isDirect);
    if (allDeps[name]) {
      if (isDirect) {
        allDeps[name].isDirectDependency = true;
      } else {
        allDeps[name].isDevDependency = true;
      }

      if (allDeps[name].version !== version) {
        if (!duplicates[name]) {
          addDuplicate(duplicates, name, `v${allDeps[name].version}`);
        }
        addDuplicate(duplicates, name, `v${version} in ${packageName}`);
      }
    } else {
      allDeps[name] = {
        version,
        isDirectDependency: isDirect,
        isDevDependency: !isDirect,
      };
    }
  }
};

module.exports = {
  keys,
  addError,

  /**
   * Sorts array of short description of dependencies sorted by:
   *   is isDirectDependency !isDevDependency
   *   is isDirectDependency isDevDependency
   *   is isDevDependency !isDirectDependency
   *   and then by name
   * @param packages - array of { name, isDirectDependency, isDevDependency }
   * @returns {*}
   */
  sortPackages: (packages) =>
    packages.sort((obj1, obj2) => {
      if (obj1.isDirectDependency === obj2.isDirectDependency && obj1.isDevDependency === obj2.isDevDependency) {
        return sortStrings(obj1.name, obj2.name);
      }
      if (obj1.isDirectDependency && !obj2.isDirectDependency) return -1;
      if (obj2.isDirectDependency && !obj1.isDirectDependency) return 1;

      if (obj1.isDirectDependency === obj2.isDirectDependency) {
        if (obj1.isDevDependency) return 1;
        return -1;
      }

      return sortStrings(obj1.name, obj2.name);
    }),

  /**
   * Adds minimal description of all the dependency from one package into the
   * given container, checks on errors first and excludes `selfapy` packages
   * @param allDeps - container of all used in project dependencies in a
   * simple format: key: name, value:
   * { version, isDirectDependency, isDevDependency }
   * @param errors - container for reporting errors in the end, format:
   * array of objects key: string, value - array of string error messages
   * @param duplicates - container for reporting duplicating errors in the
   * end, format: array of objects key: string, value - array of string
   * containing version and package name if was possible to identify it
   * @param devDeps
   * @param deps
   * @param packageName
   */
  collectPackageDependencies: (allDeps, errors, duplicates, devDeps, deps, packageName) => {
    const duplicateDev = findDuplicates(devDeps, deps);
    if (duplicateDev.length > 0) {
      addError(errors, packageName, `devDependencies and dependencies have same dependencies: ${duplicateDev}`);
    }

    keys({ ...devDeps }).forEach((dep) => {
      addDependency(allDeps, errors, duplicates, devDeps[dep], dep, packageName);
    });

    keys({ ...deps }).forEach((dep) => {
      addDependency(allDeps, errors, duplicates, deps[dep], dep, packageName, true);
    });
  },
};
