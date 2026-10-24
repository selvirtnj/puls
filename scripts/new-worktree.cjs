const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const args=process.argv.slice(2),dry=args.includes('--dry-run'),pos=args.filter(x=>x!=='--dry-run');
if(pos.length!==2||!['frontend','backend','review'].includes(pos[0])||! /^[a-z0-9][a-z0-9-]{0,47}$/.test(pos[1])){console.error('Usage: node scripts/new-worktree.cjs frontend|backend|review task-name [--dry-run]');process.exit(1)}
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
try{
 const root=path.resolve(git('rev-parse','--show-toplevel'));if(path.resolve(process.cwd())!==root)throw Error('Run from the repository root.');
 if(git('status','--porcelain'))throw Error('Commit or preserve existing changes before creating a parallel workspace.');
 const base=git('rev-parse','HEAD'),branch='agent/'+pos.join('-'),parent=path.join(path.dirname(root),path.basename(root)+'-worktrees'),target=path.resolve(parent,pos.join('-'));
 if(!target.startsWith(path.resolve(parent)+path.sep))throw Error('Invalid target path.');
 if(fs.existsSync(target))throw Error('Target already exists; inspect and reuse it instead.');
 let exists=false;try{git('show-ref','--verify','--quiet','refs/heads/'+branch);exists=true}catch{}if(exists)throw Error('Branch already exists; inspect and reuse it instead.');
 console.log(JSON.stringify({role:pos[0],branch,base,target,dryRun:dry},null,2));
 if(!dry){fs.mkdirSync(parent,{recursive:true});execFileSync('git',['worktree','add','-b',branch,target,base],{stdio:'inherit'});console.log('Workspace ready. Give this exact path and assigned files to the specialist. No push performed.');}
}catch(error){console.error(error.message);process.exitCode=1}
