import * as ajax from "../third_party/rodin-sandbox/lib/ajax.js";
import * as path from "../third_party/rodin-sandbox/lib/path.js";
import {JSHandler} from "../third_party/rodin-sandbox/lib/JSHandler.js";
import * as semver from '../third_party/semver/semver.js';
import * as RodinPackage from './RodinPackage.js';

window.RodinPackage = RodinPackage;
window.semver = semver;

let cdn_url = 'https://cdn.rodin.io/';
const default_env = 'prod';

const getURL = (filename, urlMap = null) => {

    if (urlMap !== null) {
        for (let i in urlMap) {
            if (filename.startsWith(i)) {
                return path.join(urlMap[i], filename.substring(i.length));
            }
        }
    }

    if (path.getFile(window.location.href).indexOf(".") !== -1) {
        return path.join(path.getDirectory(window.location.href), filename);
    }
    return path.join(window.location.href, filename);
};

const getManifest = () => {
    return ajax.get(getURL('rodin_package.json')).then((data) => {

        const dependencyMap = {};

        const _resolveManifest = (pkg) => {
            // const pkg = JSON.parse(manifest);
            const env = pkg.env || default_env;
            console.log(`Running ${pkg.name}...`);

            const promises = [];

            for (let i in pkg.dependencies) {
                // todo: check for semver versions and do all the resolutions

                if (dependencyMap.hasOwnProperty(i)) {
                    continue;
                }
                let version = null;

                promises.push(ajax.get(path.join(cdn_url, i, 'meta.json')).then((meta) => {
                    try {
                        meta = JSON.parse(meta);
                    } catch (ex) {
                        // reject
                    }

                    version = pkg.dependencies[i];
                    const availableVersions = meta.v;

                    if (meta.semver) {
                        version = semver.maxSatisfying(availableVersions, version);
                    }
                    if (version === null || (!meta.semver && availableVersions.indexOf(version) === -1)) {
                        throw new Error(`Invalid version for ${cdn_url}, ${version}`);
                    }


                    return ajax.get(path.join(cdn_url, i, version, 'rodin_package.json'));

                }).then((data) => {
                    const pkg = RodinPackage.getEnv(JSON.parse(data), env);
                    dependencyMap[i] = path.join(cdn_url, i, version, pkg.main);
                    return _resolveManifest(pkg);
                }));
            }

            return Promise.all(promises);
        };
        const pkg = JSON.parse(data);
        cdn_url = pkg.___cdn_url || cdn_url;

        return _resolveManifest(pkg).then(() => {
            console.log(dependencyMap);
            return Promise.resolve({dependencyMap, main: getURL(pkg.main || 'index.js', dependencyMap)});
        });
    });
};

getManifest().then((data) => {
    console.log('data', data);
    new JSHandler(data.main, data.dependencyMap);
});