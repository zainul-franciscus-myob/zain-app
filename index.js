/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */

const createScheduler = require('probot-scheduler')

module.exports = (app) => {


  createScheduler(app,{
    delay: false,
    interval: 60 * 60 * 1000 // 1 hour
  });


  app.on('schedule.repository', async (context) => {
    const fork = context.payload.repository.fork;
    const private = context.payload.repository.private;

    if(fork || private) {
      console.log('this project is a fork or a private repo dont bother scanning it');
      return;
    }

    const login = context.payload.repository.owner.login;
    const repoName = context.payload.repository.name;
    const defaultBranch = context.payload.repository.default_branch;

    try {
      const packageJSON = await context.github.request(`GET /repos/${login}/${repoName}/contents/package.json`);
      const content = Buffer.from(packageJSON.data.content, "base64").toString();
      if(content.indexOf('myob-widget') < 0) {
        console.log('this project is not using myob-widget. dont bother scanning it');
        return;
      }
    }catch(e){
      console.log('this project has no package.json. Dont bother scanning it');
      return;
    }

    const branch = await context.github.request(`GET /repos/${login}/${repoName}/branches/${defaultBranch}`);

    const readRepo = async ({login, repoName, sha}) => await context.github.request(`GET /repos/${login}/${repoName}/git/trees/${sha}`);

    const readFiles = (files,path) => files.data.tree.forEach(async file => {

      if(file.type === 'blob' && file.path.match(/^.*\.(js|jsx|ts)$/)) {
        await context.github.request(`GET /repos/${login}/${repoName}/contents/${path.join('/')}/${file.path}`);//this is just tosi
        console.log(repoName, 'js file',path.join('/'),file.path)
      }

      if(file.type === 'tree' && file.path.indexOf('test') < 0) {
        const filesInTree = await readRepo({
          login,
          repoName,
          sha: file.sha
        });

        readFiles(filesInTree,path.concat([file.path]))
      }
    });

    readFiles(await readRepo({
      login,
      repoName,
      sha: branch.data.commit.sha
    }),[]);
  })

};
