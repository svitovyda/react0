const { differenceInDays, parseISO, startOfDay, format } = require("date-fns");

const https = require("https");

const MIN_DAYS_TO_USE = 31;

const today = startOfDay(Date.now());

const { keys, addError } = require("./dependencies-checker-helper");

const APIURL = "https://api.npmjs.org/";
const REGISTRYURL = "https://registry.npmjs.org/";

/**
 const retryFetch = (url, retries = 5) => {
 * retryFetch recursion
 * @param url: string
 * @param n: integer
 * @param resolve: function to resolve promise
 * @param reject: function to reject promise
 */
const retry = (url, n, resolve, reject) =>
  https
    .get(url, (res) => {
      let data = [];
      res.on("data", (chunk) => data.push(chunk));
      // eslint-disable-next-line no-undef
      res.on("end", () => resolve(JSON.parse(Buffer.concat(data).toString())));
    })
    .on("error", (err) => {
      if (n > 0) {
        return retry(url, n - 1, resolve, reject);
      } else {
        reject(err);
      }
    });

/**
 * tries to fetch the url several times
 * @param url: string
 * @param retries: integer
 */
const retryFetch = async (url, retries = 3) => new Promise((resolve, reject) => retry(url, retries, resolve, reject));

const defaultNpmData = {
  name: "",
  description: "",
  license: "",
  totalDownloads: 0,
  currentVersion: {
    version: "",
    time: "",
    downloads: 0,
  },
  latestMinorVersion: {
    version: "",
    time: "",
    downloads: 0,
  },
  latestVersion: {
    version: "",
    time: "",
    downloads: 0,
  },
  repository: "",
  homepage: "",
  incidents: "",
  author: "",
  maintainers: [],
};

const tooYoung = (date) => differenceInDays(today, date) < MIN_DAYS_TO_USE;

/**
 * Repo link can be specified in different ways, we need a link to github
 * @param value - as it is fetched from NPM API or any other library that
 * reads package root `package.json` or `node_modules`
 * @returns {string} url
 */
const transformRepoLink = (value) => {
  if (!value) return "";
  if (value.url && typeof value.url === "string" && /github\.com/.test(value.url)) {
    let repository = value.url.replace("git+ssh://git@", "git://");
    repository = repository.replace("git+https://github.com", "https://github.com");
    repository = repository.replace("git://github.com", "https://github.com");
    repository = repository.replace("git@github.com:", "https://github.com/");
    repository = repository.replace(/\.git$/, "");
    return repository;
  } else if (value.repository) {
    return value.repository.toString();
  } else {
    return "";
  }
};

/**
 * Converts version to number to simplify comparing
 * @param version - version of the package, should be in format
 * `/^(\d+\.)?(\d+\.)?\d+$/`
 * @returns {number}, each step of version multiplied by 10000, ie for '1.2.3'
 * it returns 100020003, for '34.45' - 3400450000, '' - 0, '0.1' - 10000,
 * '0.0.345' - 345
 **/

const versionToNumber = (version) => {
  const numbers = version.split(".").map((n) => Number(n));
  const major = Number.isSafeInteger(numbers[0]) ? numbers[0] * 100000000 : 0;
  const minor = Number.isSafeInteger(numbers[1]) ? numbers[1] * 10000 : 0;
  const patch = Number.isSafeInteger(numbers[2]) ? numbers[2] : 0;
  return major + minor + patch;
};

/**
 * Fetches from NPM API endpoint all weekly downloads of package, total
 * and by versions
 * Filters versions by final version (`/^(\d+\.)?(\d+\.)?\d+$/` pattern) and
 * returns only versions not older than current
 * @param name - name of the package
 * @param version - current version used in the project
 * @returns {Object}, key: string - version or 'total', value - number
 **/
const fetchNpmDownloads = async (name, version) => {
  const result = {};
  const urlName = name.replace("/", "%2F");
  const totalJson = await retryFetch(`${APIURL}downloads/point/last-week/${urlName}`);
  if (totalJson.downloads) {
    result.total = totalJson.downloads;
  }

  const currentVersionNum = versionToNumber(version);

  const versionsJson = await retryFetch(`${APIURL}versions/${urlName}/last-week`);
  if (versionsJson && versionsJson.downloads) {
    keys(versionsJson.downloads).forEach((ver) => {
      // filter out any versions with letters, like 'rc', 'alpha' etc.
      if (/^(\d+\.)?(\d+\.)?\d+$/.test(ver) && versionToNumber(ver) >= currentVersionNum) {
        result[ver] = versionsJson.downloads[ver];
      }
    });
  }
  return result;
};
/**
 * Simplify look of the release date of the version of package
 * @param date - string, like '2021-04-12T10:36:12.835Z'
 */
const formatTime = (date) => format(parseISO(date), "yyyy-MM-dd");

/**
 * Filters all versions by final version (`/^(\d+\.)?(\d+\.)?\d+$/` pattern),
 * not older than current version (not included), not younger than 31 day
 * @param versions - versions of the package, returned as part of a request
 * to the REGISTRY NPM API
 * @param version - current version of the package
 * @param time - release dates of each version, as they are returned as part of
 * a request to the REGISTRY NPM API
 * @param downloads result of `fetchNpmDownloads`
 * @returns {Object}
 * { version, date ('2013-12-19T22:26:49.880Z'), downloads (number) }
 */
const filterVersions = (versions, version, time, downloads) => {
  const res = {};
  const minV = versionToNumber(version);

  keys(versions).forEach((v) => {
    if (/^(\d+\.)?(\d+\.)?\d+$/.test(v) && versionToNumber(v) > minV) {
      let isTooYoung = false;
      if (time[v]) {
        const date = startOfDay(parseISO(time[v]));
        isTooYoung = tooYoung(date);
      }
      if (!isTooYoung) {
        res[v] = {
          version: v,
          time: formatTime(time[v]),
          downloads: downloads[v] === undefined ? null : downloads[v],
        };
      }
    }
  });
  return res;
};

// returns latest minor/patch releas, versions should be already filtered by
// filterUpperVersions
/**
 * Tries to return latest version for the same major version of the current one
 * If no minot/patch were released, returns current version
 * @param versions - result of filterVersions
 * @param current current version object { version, downloads, time }
 * @returns {Object}
 * { version, downloads, time }
 */
const getLatestMinor = (versions, current) => {
  const major = `${current.version.split(".")[0]}.`;
  let res = current;
  keys(versions).forEach((v) => {
    if (v.startsWith(major) && versionToNumber(v) > versionToNumber(current.version)) {
      res = versions[v];
    }
  });
  return res;
};

/**
 * Returns full details about given package, fetched from NPM API
 * Updates errors container if the version release was too soon
 * @param errors - container for reporting errors in the end, format:
 * array of objects key: string, value - array of string error messages
 * @param name - package name
 * @param version - current version used in project
 * @param isDirect - only if the dependency is direct there will be error check
 * @returns {Promise<Object>}
 * {
 *   maintainers: [],
 *   license: string,
 *   latestVersion: {
 *     downloads: number,
 *     time: string,
 *     version: string
 *   },
 *   totalDownloads,
 *   latestMinorVersion: {
 *     downloads: number,
 *     time: string,
 *     version: string
 *   },
 *   author: string,
 *   name,
 *   incidents: string,
 *   description: string,
 *   repository: string,
 *   currentVersion: {
 *     downloads: number,
 *     time: string,
 *     version: string
 *   },
 *   homepage: string
 * }
 */
module.exports = async (errors, name, version, isDirect) => {
  const downloads = await fetchNpmDownloads(name, version);

  const currentVersion = {
    ...defaultNpmData.currentVersion,
    version,
    downloads: downloads[version],
  };

  const result = {
    ...defaultNpmData,
    name,
    totalDownloads: downloads.total === undefined ? null : downloads.total,
  };

  const json = await retryFetch(`${REGISTRYURL}${name}`);
  if (json && json.name === name) {
    result.description = json.description;
    result.author = json.author ? json.author?.name || json.author.toString() : "";
    result.maintainers = json.maintainers ? json.maintainers.slice(0, 15).map((m) => m.name || m.toString()) : [];
    result.repository = transformRepoLink(json.repository);
    result.homepage = json.homepage;
    result.incidents = json.bugs ? json.bugs?.url || json.bugs.toString() : "";
    result.license = json.license;

    currentVersion.time = formatTime(json.time[version]);
    if (isDirect && tooYoung(currentVersion.time)) {
      addError(errors, name, `version ${version} is too young, it was released ${currentVersion.time}`);
    }
    result.currentVersion = currentVersion;

    const newVersions = filterVersions(json.versions, version, json.time, downloads);
    const newVersionsKeys = keys(newVersions);

    if (newVersionsKeys.length > 0) {
      result.latestVersion = newVersions[newVersionsKeys[newVersionsKeys.length - 1]];
      result.latestMinorVersion = getLatestMinor(newVersions, currentVersion);
    }
    if (!result.latestVersion?.version || result.latestVersion.version === currentVersion.version) {
      result.latestVersion = undefined;
    }
    if (!result.latestMinorVersion?.version || result.latestMinorVersion.version === currentVersion.version) {
      result.latestMinorVersion = undefined;
    }
  }
  return result;
};
