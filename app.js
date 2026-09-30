const KEY='equip-control-data-v1';
const AUTH_KEY='equip-control-auth-v1';
const AUTH={userSalt:'QKfZvMHrFlyukcNCfehsHg==',userHash:'pRlheaocQH0enQrC1/NiB0MtGfCYmn8tnPGflg4nwDI=',passwordSalt:'Qqdjf9awGUBf9UQ8Mg9UPw==',passwordHash:'AdMZ4WwonqNLd07i4mBV/zkGBni9xGHnABFr8VGE1Mc=',memory:65536,time:3,parallelism:2,hashLength:32};
let items=migrateData(load());
let selected=[];
let editing=null;
let editingImage='';
let pendingDelete=null;
let undoData=null;
let undoTimer=null;

const $=id=>document.getElementById(id);
function load(){try{
  const stored=localStorage.getItem(KEY);
  if(stored===null)return [];
  const parsed=JSON.parse(stored);
  return Array.isArray(parsed)?parsed:[];
}catch{return []}}
function migrateData(data){
  if(!Array.isArray(data))return [];
  if(!data.length)return data;
  if(!data.some(item=>item.groupId))return data;
  const groups=new Map();
  data.forEach(item=>{
    const key=item.groupId||item.id;
    const current=groups.get(key);
    if(!current){
      groups.set(key,{...item,id:item.id,quantity:Math.max(1,Number(item.quantity)||1),status:item.status||'Guardado'});
      return;
    }
    current.quantity+=Math.max(1,Number(item.quantity)||1);
    if(item.status==='Em Uso')current.status='Em Uso';
    else if(item.status==='Manutenção'&&current.status!=='Em Uso')current.status='Manutenção';
  });
  const migrated=[...groups.values()].map(({groupId,...item})=>item);
  localStorage.setItem(KEY,JSON.stringify(migrated));
  return migrated;
}

function persist(){localStorage.setItem(KEY,JSON.stringify(items))}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function money(v){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
function statusClass(s){return s==='Em Uso'?'use':s==='Manutenção'?'maintenance':''}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function base64ToBuffer(base64){const binary=atob(base64);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes.buffer}
function dataUrlParts(dataUrl){const match=String(dataUrl||'').match(/^data:([^;]+);base64,(.+)$/);return match?{mime:match[1],base64:match[2]}:null}
function isLoggedIn(){return sessionStorage.getItem(AUTH_KEY)==='1'}

async function verifyCredentials(username,password){
  if(!window.argon2)throw new Error('Biblioteca de segurança indisponível.');
  const userResult=await argon2.hash({pass:username,salt:new Uint8Array(base64ToBuffer(AUTH.userSalt)),type:argon2.ArgonType.Argon2id,time:AUTH.time,mem:AUTH.memory,parallelism:AUTH.parallelism,hashLen:AUTH.hashLength});
  const passwordResult=await argon2.hash({pass:password,salt:new Uint8Array(base64ToBuffer(AUTH.passwordSalt)),type:argon2.ArgonType.Argon2id,time:AUTH.time,mem:AUTH.memory,parallelism:AUTH.parallelism,hashLen:AUTH.hashLength});
  const userHash=btoa(String.fromCharCode(...userResult.hash));
  const passwordHash=btoa(String.fromCharCode(...passwordResult.hash));
  return userHash===AUTH.userHash&&passwordHash===AUTH.passwordHash;
}

function getFilteredItems(){
  const q=$('search').value.toLowerCase().trim();
  const sf=$('statusFilter').value;
  const df=$('departmentFilter').value;
  return items.filter(i=>(!q||i.name.toLowerCase().includes(q)||(i.patrimonio||'').toLowerCase().includes(q))&&(sf==='Todos'||i.status===sf)&&(df==='Todos'||i.department===df));
}

function render(){
  const filtered=getFilteredItems();
  const currentDepartment=$('departmentFilter').value;
  $('total').textContent=items.reduce((sum,i)=>sum+Math.max(0,Number(i.quantity)||0),0);
  $('inUse').textContent=items.filter(i=>i.status==='Em Uso').reduce((sum,i)=>sum+Math.max(0,Number(i.quantity)||0),0);
  $('stored').textContent=items.filter(i=>i.status==='Guardado').reduce((sum,i)=>sum+Math.max(0,Number(i.quantity)||0),0);
  $('maintenance').textContent=items.filter(i=>i.status==='Manutenção').reduce((sum,i)=>sum+Math.max(0,Number(i.quantity)||0),0);
  $('resultCount').textContent=`${filtered.length} ${filtered.length===1?'registro encontrado':'registros encontrados'}`;
  const depts=[...new Set(items.map(i=>i.department))].sort();
  $('departmentFilter').innerHTML='<option>Todos</option>'+depts.map(d=>`<option>${esc(d)}</option>`).join('');
  $('departmentFilter').value=depts.includes(currentDepartment)?currentDepartment:'Todos';
  $('tableBody').innerHTML=filtered.map(row).join('');
  $('empty').classList.toggle('hidden',filtered.length!==0);
  document.querySelectorAll('.row-check').forEach(el=>el.addEventListener('change',()=>toggle(el.dataset.id)));
  document.querySelectorAll('.status-select').forEach(el=>el.addEventListener('change',()=>changeStatus(el.dataset.id,el.value)));
  document.querySelectorAll('.edit-btn').forEach(el=>el.addEventListener('click',()=>openEdit(el.dataset.id)));
  document.querySelectorAll('.delete-btn').forEach(el=>el.addEventListener('click',()=>askDelete(el.dataset.id)));
  const visibleIds=filtered.map(i=>i.id);
  $('selectAll').checked=visibleIds.length>0&&visibleIds.every(id=>selected.includes(id));
  $('bulkActions').classList.toggle('hidden',selected.length===0);
  $('selectedCount').textContent=`${selected.length} ${selected.length===1?'registro':'registros'}`;
}

function icon(name, size = 18) {
  const paths = {
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1.1l1.8-1.8a5 5 0 0 0-7.1-7.1L10.7 5.3"/><path d="M14 11a5 5 0 0 0-7.1-.1l-1.8 1.8a5 5 0 0 0 7.1 7.1l1.1-1.1"/>',
    package: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/>',
  };
  return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function row(i){
  return `<tr><td><input class="row-check" data-id="${i.id}" type="checkbox" ${selected.includes(i.id)?'checked':''}></td><td><div class="item-cell"><div class="item-image">${i.image?`<img src="${esc(i.image)}" alt="${esc(i.name)}">`:icon('package',26)}</div><div><b>${esc(i.name)}</b><small>${esc(i.patrimonio||'Sem patrimônio')}</small></div></div></td><td>${esc(i.department)}</td><td>R$ ${money(i.value)}</td><td class="quantity-cell">${Math.max(1,Number(i.quantity)||1)}</td><td><select class="status ${statusClass(i.status)} status-select" data-id="${i.id}"><option ${i.status==='Guardado'?'selected':''}>Guardado</option><option ${i.status==='Em Uso'?'selected':''}>Em Uso</option><option ${i.status==='Manutenção'?'selected':''}>Manutenção</option></select></td><td><div class="actions"><button class="icon-btn edit-btn" data-id="${i.id}" title="Editar equipamento">${icon('edit',17)}</button><button class="icon-btn delete-btn" data-id="${i.id}" title="Excluir">${icon('trash',17)}</button></div></td></tr>`;
}

function toggle(id){selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];render()}
function changeStatus(id,status){const previousItems=JSON.parse(JSON.stringify(items));const x=items.find(i=>i.id===id);if(!x||x.status===status)return;x.status=status;persist();render();showUndo('Status atualizado.');undoData={type:'update',previousItems};}
function openNew(){editing=null;editingImage='';$('modalTitle').textContent='Novo equipamento';$('saveBtn').textContent='✓ Cadastrar equipamento';fillForm();$('modal').classList.remove('hidden')}
function openEdit(id){editing=items.find(i=>i.id===id);if(!editing)return;editingImage=editing.image||'';$('modalTitle').textContent='Editar equipamento';$('saveBtn').textContent='✓ Salvar alterações';fillForm(editing);$('modal').classList.remove('hidden')}
function fillForm(x={}){$('name').value=x.name||'';$('department').value=x.department||'';$('value').value=x.value??0;$('quantity').value=x.quantity||1;$('patrimonio').value=(x.patrimonio??x.description??'');$('image').value=x.image&&x.image.startsWith('data:')?'':x.image||'';$('imageFile').value=''}
function closeModal(){$('modal').classList.add('hidden');editing=null;editingImage=''}

function readFileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}

async function save(e){
  e.preventDefault();
  const previousItems=editing?JSON.parse(JSON.stringify(items)):null;
  const file=$('imageFile').files[0];
  const uploadedImage=file?await readFileAsDataUrl(file):'';
  const imageInput=$('image').value.trim();
  const image=uploadedImage||imageInput||(editing?editingImage:'');
  const data={name:$('name').value.trim(),department:$('department').value.trim(),value:Number($('value').value)||0,quantity:Math.max(1,Number($('quantity').value)||1),patrimonio:$('patrimonio').value.trim(),image};
  if(!data.name||!data.department)return;
  if(editing){items=items.map(x=>x.id===editing.id?{...x,...data}:x);persist();closeModal();render();showUndo('Equipamento atualizado.');undoData={type:'update',previousItems};}
  else{items.push({...data,id:uid(),status:'Guardado'});persist();closeModal();render();toast('Equipamento cadastrado.');}
}

function askDelete(id){const item=items.find(x=>x.id===id);if(!item)return;pendingDelete={ids:[id]};$('deleteMessage').textContent=`O equipamento “${item.name}” será removido. Você poderá desfazer a exclusão por 3 segundos.`;$('deleteModal').classList.remove('hidden')}
function askBulkDelete(){const ids=selected.filter(id=>items.some(item=>item.id===id));if(!ids.length)return;pendingDelete={ids};$('deleteMessage').textContent=`${ids.length} ${ids.length===1?'equipamento será removido':'equipamentos serão removidos'}. Você poderá desfazer a exclusão por 3 segundos.`;$('deleteModal').classList.remove('hidden')}
function closeDelete(){$('deleteModal').classList.add('hidden');pendingDelete=null}
function confirmDelete(){if(!pendingDelete)return;const ids=pendingDelete.ids||[];const deleted=items.map((item,index)=>({item,index})).filter(({item})=>ids.includes(item.id));if(!deleted.length){closeDelete();return}clearUndo();items=items.filter(item=>!ids.includes(item.id));selected=selected.filter(id=>!ids.includes(id));persist();render();closeDelete();undoData={type:'deleteMany',deleted};showUndo(`${deleted.length} ${deleted.length===1?'equipamento excluído.':'equipamentos excluídos.'}`)}

function showUndo(message){$('toast').querySelector('.toast-message').textContent=message;$('undoBtn').classList.remove('hidden');$('toast').classList.remove('hidden');clearTimeout(undoTimer);undoTimer=setTimeout(()=>{undoData=null;$('toast').classList.add('hidden')},3000)}
function clearUndo(){clearTimeout(undoTimer);undoTimer=null;undoData=null;$('toast').classList.add('hidden')}
function undoDelete(){
  if(!undoData)return;
  if(undoData.type==='delete'){const {item,index}=undoData;items.splice(Math.min(index,items.length),0,item);persist();render();clearUndo();toast('Exclusão desfeita.');return;}
  if(undoData.type==='deleteMany'){undoData.deleted.slice().sort((a,b)=>a.index-b.index).forEach(({item,index})=>items.splice(Math.min(index,items.length),0,item));persist();render();clearUndo();toast('Exclusão em massa desfeita.');return;}
  if(undoData.type==='update'){items=undoData.previousItems;persist();render();clearUndo();toast('Atualização desfeita.');}
}
function bulk(){const previousItems=JSON.parse(JSON.stringify(items));const s=$('bulkStatus').value;items=items.map(x=>selected.includes(x.id)?{...x,status:s}:x);const n=selected.length;selected=[];persist();$('bulkModal').classList.add('hidden');render();showUndo(`${n} ${n===1?'equipamento atualizado':'equipamentos atualizados'}.`);undoData={type:'update',previousItems};}
function toast(msg){$('toast').querySelector('.toast-message').textContent=msg;$('toast').classList.remove('hidden');$('undoBtn').classList.add('hidden');clearTimeout(window._toast);window._toast=setTimeout(()=>$('toast').classList.add('hidden'),2800)}

function loadImageForExcel(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.crossOrigin = 'anonymous';
    image.src = source;
  });
}

async function imageToExcelData(imageSource) {
  if (!imageSource) return null;

  try {
    let source = imageSource;
    let objectUrl = null;

    if (!source.startsWith('data:')) {
      const response = await fetch(source, { mode: 'cors' });

      if (!response.ok) throw new Error('Imagem indisponível.');

      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      source = objectUrl;
    }

    const image = await loadImageForExcel(source);
    const canvas = document.createElement('canvas');
    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));

    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponível.');

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngDataUrl = canvas.toDataURL('image/png');
    const parts = pngDataUrl.split(',');

    if (objectUrl) URL.revokeObjectURL(objectUrl);

    return {
      mime: 'image/png',
      base64: parts[1],
    };
  } catch (error) {
    console.warn('Não foi possível incorporar a imagem ao Excel:', error);
    return null;
  }
}

async function exportXlsx(){
  if(!items.length){toast('Não há equipamentos cadastrados para exportar.');return}
  if(!window.ExcelJS){toast('Biblioteca do Excel ainda não carregou.');return}
  const btn=$('exportBtn');btn.disabled=true;btn.textContent='Exportando...';
  try{
    const workbook=new ExcelJS.Workbook();
    workbook.creator='EquipControl';workbook.created=new Date();
    const sheet=workbook.addWorksheet('Equipamentos');
    sheet.columns=[{header:'ID',key:'id',width:20},{header:'Nome',key:'name',width:28},{header:'Departamento',key:'department',width:22},{header:'Valor unitário',key:'value',width:16},{header:'Quantidade',key:'quantity',width:12},{header:'Patrimônio',key:'patrimonio',width:24},{header:'Status',key:'status',width:18},{header:'Imagem',key:'image',width:18}];
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF245F5A'}};sheet.getRow(1).height=24;sheet.views=[{state:'frozen',ySplit:1}];
    for(let index=0;index<items.length;index++){
      const item=items[index];const row=sheet.addRow({id:item.id,name:item.name,department:item.department,value:Number(item.value)||0,quantity:Math.max(1,Number(item.quantity)||1),patrimonio:item.patrimonio||item.description||'',status:item.status,image:item.image?'Sim':'Não'});
      row.getCell('value').numFmt='R$ #,##0.00';row.alignment={vertical:'top',wrapText:true};row.height=75;
      const imageData=await imageToExcelData(item.image);
      if(imageData){
        const extension=imageData.mime.includes('png')?'png':imageData.mime.includes('gif')?'gif':'jpeg';
        const imageId=workbook.addImage({base64:imageData.base64,extension});
        sheet.addImage(imageId,{tl:{col:8,row:index+1},ext:{width:80,height:65}});
      }
    }
    const buffer=await workbook.xlsx.writeBuffer();const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`equipamentos-${new Date().toISOString().slice(0,10)}.xlsx`;a.click();URL.revokeObjectURL(url);toast('Arquivo .xlsx exportado com sucesso.')
    if(items.some(i=>i.image&&!i.image.startsWith('data:')))toast('Exportação concluída. Imagens externas podem depender de permissão CORS para serem incorporadas.');
  }catch(error){console.error(error);toast('Não foi possível gerar o arquivo .xlsx.')}finally{btn.disabled=false;btn.textContent='⇩ Exportar .xlsx'}
}

async function login(e){
  e.preventDefault();const user=$('loginUsername').value.trim().toLowerCase();const password=$('loginPassword').value;$('loginError').classList.add('hidden');$('loginButton').disabled=true;$('loginButton').textContent='Verificando...';
  try{const valid=await verifyCredentials(user,password);if(!valid){$('loginError').classList.remove('hidden');return}sessionStorage.setItem(AUTH_KEY,'1');showApp()}catch(error){$('loginError').textContent='Não foi possível validar o acesso. Verifique sua conexão e tente novamente.';$('loginError').classList.remove('hidden')}finally{$('loginButton').disabled=false;$('loginButton').textContent='Entrar'}
}
function showApp(){$('loginScreen').classList.add('hidden');$('app').classList.remove('hidden');render()}
function logout(){sessionStorage.removeItem(AUTH_KEY);$('app').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('loginPassword').value=''}

$('loginForm').onsubmit=login;
$('newBtn').onclick=openNew;$('closeModal').onclick=closeModal;$('cancelModal').onclick=closeModal;$('equipmentForm').onsubmit=save;$('search').oninput=render;$('statusFilter').onchange=render;$('departmentFilter').onchange=render;$('undoBtn').onclick=undoDelete;$('closeBulk').onclick=()=>$('bulkModal').classList.add('hidden');$('cancelBulk').onclick=()=>$('bulkModal').classList.add('hidden');$('applyBulk').onclick=bulk;$('bulkBtn').onclick=()=>$('bulkModal').classList.remove('hidden');$('bulkDeleteBtn').onclick=askBulkDelete;$('closeDelete').onclick=closeDelete;$('cancelDelete').onclick=closeDelete;$('confirmDelete').onclick=confirmDelete;$('exportBtn').onclick=exportXlsx;$('logoutBtn').onclick=logout;
$('selectAll').onchange=()=>{const ids=getFilteredItems().map(i=>i.id);selected=$('selectAll').checked?[...new Set([...selected,...ids])]:selected.filter(id=>!ids.includes(id));render()};
window.onclick=e=>{if(e.target===$('modal'))closeModal();if(e.target===$('bulkModal'))$('bulkModal').classList.add('hidden');if(e.target===$('deleteModal'))closeDelete()};

if(isLoggedIn())showApp();
