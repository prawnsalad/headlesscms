const git = require('nodegit');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');

function trimSlash(i) {
    return i.replace(/\/$/, '');
}

function updatorError(message, fromErr) {
    let err = new Error(message);
    if (fromErr) {
        err.stack = fromErr.stack;
    }
    err.type = 'updator';
    return err;
}

module.exports.updateFromGit = updateFromGit;
async function updateFromGit(ctx, collection) {
    let gitconf;
        
    try {
        gitconf = await collection.loadConfigFile('git.yml');
    } catch (err) {
        throw updatorError('Git is not enabled for this site');
    }

    if (!gitconf || !gitconf.repository || !gitconf.repository.url) {
        throw updatorError('No repository configured');
    }

    // Create a temporary folder for us to clone the repo into
    let tempPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nodecms-'));

    let cloneOpts = new git.CloneOptions();
    cloneOpts.checkoutBranch = gitconf.repository.branch || 'master';
    ctx.log(1, 'git.Clone', [gitconf.repository.url, tempPath]);
    await git.Clone(gitconf.repository.url, tempPath);

    // We might need to read a specific folder from the git repo
    let newSrcPath = path.join(tempPath, gitconf.repository.folder || '');

    // Delete the .config/git .yml file as that should only be set on the server directly
    ctx.log(2, 'fs.remove', [path.join(newSrcPath, '.config/git.yml')]);
    await fs.remove(path.join(newSrcPath, '.config/git.yml'));

    // Move our existing live folder as a backup
    let backupSuffix = (new Date()).toISOString().replace(/[-T:Z]|\.\d+/g, '');
    let currentSitePath = trimSlash(collection.sitePath);
    let backupPath = currentSitePath + '_' + backupSuffix;
    ctx.log(3, 'fs.move', [currentSitePath, backupPath]);
    await fs.move(currentSitePath, backupPath);

    // Move our new content to the current live location
    ctx.log(4, 'fs.move', [trimSlash(newSrcPath), currentSitePath]);
    await fs.move(trimSlash(newSrcPath), currentSitePath);

    // Restore .config/git.yml config
    ctx.log(5, 'fs.copy', [path.join(backupPath, '.config/git.yml'), path.join(currentSitePath, '.config/git.yml')]);
    await fs.copy(path.join(backupPath, '.config/git.yml'), path.join(currentSitePath, '.config/git.yml'));

    // Clean up any temp folders
    ctx.log(6, 'fs.remove', [tempPath]);
    await fs.remove(tempPath);
}