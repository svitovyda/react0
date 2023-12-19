const fs = require("fs/promises");
const glob = require("glob");
const path = require("path");

const { keys, addError, collectPackageDependencies, sortPackages } = require("./dependencies-checker-helper.js");
const getNpmDetails = require("./npm-helper.js");

const MINIMUM_DOWNLOADS = 1000;

const root = path.resolve(__dirname, "..");

/**
 * Scans entire project and collects short description of all the
 * dependencies, also collects errors
 * @returns {{duplicates, errors, allDeps}}:
 * allDeps - all deduplicated dependencies from all package.json files, as:
 *   key: name, value: {version, isDirectDependency, isDevDependency}
 * duplicates - dependencies that are used in different places in the project
 *   with different versions, as:
 *   key: name, value: string[] `${version} ${package}`
 * errors - found errors, like non-fixed version and `@types` as direct
 *   dependency, duplicating dependency in one file, as:
 *   key: name, value: string[]
 **/
const readAllWorkspaces = () => {
  const allDeps = {};
  const duplicates = {};
  const errors = {};

  const { devDependencies, dependencies, workspaces, resolutions } = require(path.resolve(root, "package.json"));

  collectPackageDependencies(allDeps, errors, duplicates, devDependencies, dependencies, "./package.json");

  workspaces?.forEach((dir) => {
    const files = glob.sync(`${dir}/package.json`);
    files.forEach((file) => {
      const { devDependencies, dependencies } = require(path.resolve(root, file));
      collectPackageDependencies(allDeps, errors, duplicates, devDependencies, dependencies, `./${file}`);
    });
  });

  keys(resolutions).forEach((key) => {
    if (allDeps[key] && allDeps[key].version !== resolutions[key]) {
      addError(errors, key, `in "resolutions" used wrong version: ${resolutions[key]} !== ${allDeps[key].version}`);
    }
  });

  return { allDeps, duplicates, errors };
};

/**
 * Goes through the keys of container of all found dependencies in the project,
 * adds detailed data fetched from NPM
 * @param allDeps - container of all used in project dependencies in a
 * simple format: key: name, value:
 * { version, isDirectDependency, isDevDependency }
 * @param errors - container for reporting errors in the end, format:
 * array of objects key: string, value - array of string error messages
 * @returns {Promise<Array<Object>>} :
 * {
 *   name,
 *   description,
 *   totalDownloads,
 *   currentVersion: {
 *     version,
 *     downloads,
 *     time,
 *   },
 *   latestVersion: {
 *     version,
 *     downloads,
 *     time,
 *   },
 *   latestMinorVersion: {
 *     version,
 *     downloads,
 *     time,
 *   },
 *   author,
 *   maintainers: [],
 *   repository,
 *   homepage,
 *   incidents,
 *   license,
 * }
 * sorted by:
 *   is isDirectDependency !isDevDependency
 *   is isDirectDependency isDevDependency
 *   is isDevDependency !isDirectDependency
 *   and then by name
 */
const addDetails = async (allDeps, errors) => {
  const result = [];
  await Promise.all(
    keys(allDeps).map(async (name) => {
      const { version, isDirectDependency, isDevDependency } = allDeps[name];
      const value = await getNpmDetails(errors, name, version, isDirectDependency);

      result.push({
        ...value,
        isDirectDependency,
        isDevDependency,
        name,
      });
    })
  );

  return sortPackages(result);
};

/**
 * Writes the final result with minimal required into and errors into
 * `dependencies.json`, that is included into the git repo, and also creates
 * `dependencies-full.json` with full information about packages (like amount
 * of weekly downloads, maintainers, new minor and major versions available)
 * and is ignored by git.
 * (both are written in to the root of the project)
 *
 * @param packages
 * @param errors
 * @param duplicates
 * @returns {Promise<Array<Object>>}
 */
const writeResults = async (packages, errors, duplicates) => {
  await fs.writeFile(path.resolve(root, "dependencies-full.json"), `${JSON.stringify(packages, null, "  ")}\n`);

  const short = packages.map((p) => ({
    ...p,
    totalDownloads: undefined,
    currentVersion: {
      ...p.currentVersion,
      downloads: undefined,
    },
    maintainers: undefined,
    latestVersion: undefined,
    latestMinorVersion: undefined,
  }));
  // write all packages without dynamic info into dependencies.json file
  await fs.writeFile(
    path.resolve(root, "dependencies.json"),
    `${JSON.stringify({ short, errors, duplicates }, null, "  ")}\n`
  );
  return packages;
};

const { duplicates, errors, allDeps } = readAllWorkspaces();

addDetails(allDeps, errors)
  .then(async (result) => {
    // log major possible upgrades
    const latest = result.filter((r) => !!r.latestVersion && r.latestVersion.version !== r.latestMinorVersion?.version);
    if (latest.length > 0) {
      console.log(`\nFYI: ${latest.length} dependencies have major version released:\n`);
      latest.forEach((p) => console.log(`  ${p.name} (v${p.currentVersion.version}): v${p.latestVersion.version}`));
    }

    // log safe minor/patch possible upgrades
    const latestMinor = result.filter((r) => !!r.latestMinorVersion);
    if (latestMinor.length > 0) {
      console.log(`\nFYI: ${latestMinor.length} dependencies can be safely upgraded:\n`);
      latestMinor.forEach((p) =>
        console.log(`  ${p.name}: v${p.currentVersion.version} -> v${p.latestMinorVersion.version}`)
      );
    }

    // log statistics
    console.log(`\nTotal packages: ${result.length}`);
    console.log(`Total errors: ${keys(errors).length}`);
    console.log(`Total different versions: ${keys(duplicates).length}\n`);

    // log warnings
    const warning = result.filter(
      (p) =>
        (p.totalDownloads !== null && p.totalDownloads < MINIMUM_DOWNLOADS) ||
        (p.currentVersion.downloads !== null && p.currentVersion.downloads < MINIMUM_DOWNLOADS)
    );

    if (warning.length > 0) {
      console.log(`\nWarning! ${warning.length} dependencies have less than ${MINIMUM_DOWNLOADS} weekly downloads:\n`);
      warning.forEach((p) =>
        console.log(`  ${p.name}: ${p.totalDownloads} (v${p.currentVersion.version}: ${p.currentVersion.downloads})`)
      );
    }
    return writeResults(result, errors, duplicates);
  })
  .then(() => {
    if (keys({ ...errors, ...duplicates }).length) {
      console.log("\nERRORS!");
      if (keys(errors).length) {
        console.log("\n");
        keys(errors).forEach((key) => {
          console.log(`  ${key}:`);
          errors[key].forEach((error) => console.log(`    ${error}`));
        });
      }
      if (keys(duplicates).length) {
        console.log("\n");
        console.log("  DUPLICATES:\n");
        keys(duplicates).forEach((key) => {
          console.log(`  ${key}:`);
          duplicates[key].forEach((error) => console.log(`    ${error}`));
        });
      }
      console.log("\n");
      process.exit(1);
    }
  });
