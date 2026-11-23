/* JOB PORTAL - shared JavaScript used by every page (frontend) */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));   // prevents XSS
const ST=['Applied','Shortlisted','Interview','Hired','Rejected'];

/* toast message */
function say(m,ok){const e=$('#msg');e.textContent=m;e.className=ok?'ok':'';e.style.display='block';setTimeout(()=>e.style.display='none',3000)}

/* call the backend REST API (fetch) */
async function api(m,u,b){
  const r=await fetch('/api/'+u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||'Request failed');
  return j;
}
const run=async f=>{try{await f()}catch(e){say(e.message)}};

/* navigation menu for each role (page folders: /user, /recruiter, /admin) */
const NAV={
 user:[['Jobs','/user/jobs.html'],['My Applications','/user/applications.html'],['Profile','/user/profile.html']],
 recruiter:[['Add Job','/recruiter/add-job.html'],['Manage Jobs','/recruiter/manage-jobs.html'],['Applications','/recruiter/applications.html'],['Profile','/recruiter/profile.html']],
 admin:[['Stats','/admin/stats.html'],['Manage Users','/admin/manage-users.html'],['All Jobs','/admin/all-jobs.html'],['Database','/admin/database.html'],['Profile','/admin/profile.html']]};

function header(u){
  $('#hd').innerHTML='<b>Job Portal</b>'+NAV[u.role].map(n=>`<a href="${n[1]}" class="${location.pathname==n[1]?'on':''}">${n[0]}</a>`).join('')+`<span>${esc(u.name)} (${u.role})</span><a onclick="logout()">Log out</a>`;
}
/* page guard: only the right role can open a page, others go to the login page */
async function guard(role){
  try{const r=await api('GET','me');if(!r.user||r.user.role!=role)throw 0;header(r.user);return r.user}
  catch(e){location.href=`/${role}/login.html`;return null}
}
const logout=()=>run(async()=>{await api('POST','logout');location.href='/index.html'});

/* login / register forms call these */
const doLogin=role=>run(async()=>{
  const r=await api('POST','login',{email:$('#e').value,password:$('#p').value});
  if(r.user.role!=role){await api('POST','logout');throw new Error('This login is only for '+role+' accounts')}
  location.href=NAV[role][0][1];
});
const doRegister=role=>run(async()=>{
  await api('POST','register',{name:$('#n').value,email:$('#e').value,password:$('#p').value,role,company:$('#co')?$('#co').value:''});
  location.href=NAV[role][0][1];
});

/* profile form (same for all roles) */
function fillProfile(u){for(const [id,k] of [['pn','name'],['pe','email'],['pl','location'],['pb','bio'],['ps','skills'],['pc','company']]){if($('#'+id))$('#'+id).value=u[k]||''}}
const saveProfile=()=>run(async()=>{
  const v=id=>$('#'+id)?$('#'+id).value:'';
  await api('PUT','me',{name:v('pn'),location:v('pl'),bio:v('pb'),skills:v('ps'),company:v('pc')});say('Profile saved',1);
});

/* job card + buttons used by several pages */
const jobCard=(j,btn)=>`<div class="cd"><div class="r"><div><h3>${esc(j.title)} ${j.open?'':'<span class="t">Closed</span>'}</h3><div class="mu">${esc(j.company)} - ${esc(j.location)} - ${esc(j.type)} - ${esc(j.salary)} - Deadline ${esc(j.deadline)}</div></div><div>${btn||''}</div></div><p>${esc(j.desc)}</p><div class="mu">Skills: ${esc(j.skills)}</div></div>`;
const jobButtons=(j,edit)=>`<button class="b m s" onclick="toggleJob(${j.id},${j.open?0:1})">${j.open?'Close':'Reopen'}</button> ${edit?`<a class="b m s" href="/recruiter/add-job.html?edit=${j.id}">Edit</a> `:''}<button class="b m d" onclick="deleteJob(${j.id})">Delete</button>`;
const toggleJob=(id,o)=>run(async()=>{await api('PUT','jobs/'+id,{open:!!o});load()});
const deleteJob=id=>{if(confirm('Delete this job and its applications?'))run(async()=>{await api('DELETE','jobs/'+id);load()})};
