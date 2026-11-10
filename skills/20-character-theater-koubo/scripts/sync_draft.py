#!/usr/bin/env python3
"""Add a new local draft, preserving existing drafts and registry entries.
来源：大鱼 AI 剪辑包 jianying-koubo-editor/scripts/sync_draft.py（去掉了未使用的样式文件读取）。仅 macOS。"""
import argparse,fcntl,hashlib,json,os,shutil,subprocess,tempfile,time,uuid
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]

def atom(path,data):
    fd,tmp=tempfile.mkstemp(prefix='.koubo-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def rewrite(v,old,new):
    if isinstance(v,str):
        canonical=str(Path(v).resolve()) if v.startswith('/') else v
        return new+canonical[len(old):] if canonical==old or canonical.startswith(old+'/') else v
    if isinstance(v,list):return [rewrite(x,old,new) for x in v]
    if isinstance(v,dict):return {k:rewrite(x,old,new) for k,x in v.items()}
    return v

def app_running():
    r=subprocess.run(['pgrep','-f','/VideoFusion-macOS.app/Contents/MacOS/'],capture_output=True,text=True)
    if r.returncode not in (0,1):raise RuntimeError('Cannot inspect running app; retry with process-list permission')
    return r.returncode==0

def sync(source,root,registry):
    src=Path(source).resolve();root=Path(root).expanduser().resolve();reg=Path(registry).expanduser().resolve()
    if app_running():raise RuntimeError('请先正常退出剪映再同步，以免首页索引被应用覆盖；不要强制结束有未保存工程的进程。')
    if not root.is_dir() or not reg.is_file():raise ValueError('Draft root/registry does not exist; discover actual installation first')
    meta=json.loads((src/'draft_meta_info.json').read_text());data=json.loads((src/'draft_content.json').read_text());name=meta['draft_name']
    if not name or name in ('.','..') or '/' in name:raise ValueError('Invalid draft name')
    dst=root/name
    if dst.exists():raise FileExistsError('Never overwrite an existing draft: '+str(dst))
    # Fail early for unstaged external media; all actual audio/video dependencies must be inside draft.
    for group in ('videos','audios'):
        for item in data.get('materials',{}).get(group,[]):
            if item.get('path'):
                path=Path(item['path']).resolve()
                if src not in path.parents or not path.is_file():raise ValueError('Missing or unstaged media '+str(path))
    with (reg.parent/'.jianying-vlog-sync.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX);original=reg.read_bytes();index=json.loads(original)
        if any(x.get('draft_id')==meta['draft_id'] for x in index['all_draft_store']):raise ValueError('Draft ID already registered')
        stage=Path(tempfile.mkdtemp(prefix='.koubo-stage-',dir=root))
        shutil.copytree(src,stage,dirs_exist_ok=True)
        for file in stage.rglob('*.json'):
            value=json.loads(file.read_text());value=rewrite(value,str(src),str(dst));file.write_text(json.dumps(value,ensure_ascii=False,indent=2))
        localmeta=json.loads((stage/'draft_meta_info.json').read_text());localmeta['draft_root_path']=str(root);localmeta['draft_fold_path']=str(dst)
        (stage/'draft_meta_info.json').write_text(json.dumps(localmeta,ensure_ascii=False,indent=2))
        record={k:localmeta.get(k,'') for k in ('draft_id','draft_name','draft_fold_path','draft_root_path','draft_cover','draft_json_file','tm_duration','tm_draft_create','tm_draft_modified')}
        record.update(draft_is_invisible=False,draft_is_cloud_temp_draft=False,draft_is_ai_shorts=False,cloud_draft_sync=False,draft_cloud_last_action_download=False,draft_type='',draft_new_version='',tm_draft_removed=0,draft_timeline_materials_size=sum(p.stat().st_size for p in (stage/'Resources').rglob('*') if p.is_file()))
        index['all_draft_store'].insert(0,record)
        if isinstance(index.get('draft_ids'),int):index['draft_ids']+=1
        if reg.read_bytes()!=original or app_running():raise RuntimeError('Registry/app changed during staging; stopped before registration. Staging retained: '+str(stage))
        backup=reg.with_name(reg.name+'.koubo-backup-'+str(time.time_ns()));backup.write_bytes(original)
        stage.rename(dst)
        if reg.read_bytes()!=original:raise RuntimeError('Concurrent registry update; draft copied but not registered. Do not restore backup blindly.')
        atom(reg,json.dumps(index,ensure_ascii=False,indent=2).encode())
        after=json.loads(reg.read_text())
        if after['all_draft_store'][1:]!=json.loads(original)['all_draft_store']:raise RuntimeError('Registry preservation check failed')
        result={'draft':str(dst),'draft_id':meta['draft_id'],'registry':str(reg),'registry_backup':str(backup),'registered':True,'gui_verified':False}
        (dst/'sync-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('draft');p.add_argument('--root',required=True);p.add_argument('--registry',required=True);a=p.parse_args();print(json.dumps(sync(a.draft,a.root,a.registry),ensure_ascii=False,indent=2))
