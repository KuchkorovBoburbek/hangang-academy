"""Assemble source OCR into individual text questions and shared passage groups.

The original page cache remains the audit source. Only illustration/advertisement
regions are cropped for student display. Manual source corrections are separate
and survive rebuilding. Answer keys must be visually verified, never inferred
from OCR table order.
"""
from pathlib import Path
import json, re, collections, statistics, html
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'content/topik-source'
OUT=ROOT/'content/topik'
CATEGORIES=[(1,2),(3,4),(5,8),(9,12),(13,15),(16,18),(19,20),(21,22),(23,24),(25,27),(28,31),(32,34),(35,38),(39,41),(42,43),(44,45),(46,47),(48,50)]
SHARED=[(19,20),(21,22),(23,24),(42,43),(44,45),(46,47),(48,50)]
INSTRUCTIONS={
 '1-2':'다음 (          )에 들어갈 말로 가장 알맞은 것을 고르십시오.',
 '3-4':'다음 밑줄 친 부분과 의미가 가장 비슷한 것을 고르십시오.',
 '5-8':'다음은 무엇에 대한 글인지 고르십시오.',
 '9-12':'다음 글 또는 도표의 내용과 같은 것을 고르십시오.',
 '13-15':'다음을 순서대로 맞게 배열한 것을 고르십시오.',
 '16-18':'다음을 읽고 (          )에 들어갈 내용으로 가장 알맞은 것을 고르십시오.',
 '25-27':'다음은 신문 기사의 제목입니다. 가장 잘 설명한 것을 고르십시오.',
 '28-31':'다음을 읽고 (          )에 들어갈 내용으로 가장 알맞은 것을 고르십시오.',
 '32-34':'다음을 읽고 내용이 같은 것을 고르십시오.',
 '35-38':'다음 글의 주제로 가장 알맞은 것을 고르십시오.',
 '39-41':'다음 글에서 <보기>의 문장이 들어가기에 가장 알맞은 곳을 고르십시오.',
}

def category(n):
 return next(f'{a}-{b}' for a,b in CATEGORIES if a<=n<=b)

def clean(text):
 text=re.sub(r'\(\s*\)', '(          )', text)
 text=text.replace('밑출 친','밑줄 친').replace('밑줄천','밑줄 친')
 return text.strip()

def rows(lines):
 result=[]
 for line in sorted(lines,key=lambda l:l['bbox']['y']+l['bbox']['height']/2):
  center=line['bbox']['y']+line['bbox']['height']/2
  if not result or abs(center-(result[-1][0]['bbox']['y']+result[-1][0]['bbox']['height']/2))>0.010:
   result.append([line])
  else:result[-1].append(line)
 return [l for row in result for l in sorted(row,key=lambda l:l['bbox']['x'])]

def join(lines,paragraph=False):
 if not lines:return ''
 result=''
 for l in lines:
  text=l['text'].strip()
  if not text:continue
  sep=' '
  if result and paragraph:
   if re.match(r'^\([가나다라]\)',text) or (l.get('page')!=previous.get('page')):sep='\n'
  result+=(sep if result else '')+text
  previous=l
 return clean(result)

def split_options(segment, insertion=False):
 segment=[{**l,'text':re.sub(r'^[lIL1]\s+', '① ',l['text'])} for l in segment]
 segment=[{**l,'text':re.sub(r'^[2?]\)\s*','② ',l['text'])} for l in segment]
 if insertion:
  start=next((i for i in range(len(segment)-1,-1,-1) if segment[i]['text'].startswith('①')),None)
  if start is not None:return segment[:start],['ㄱ','ㄴ','ㄷ','ㄹ'],segment[start]
 # Circled option digits are present even when Vision combines adjacent columns.
 starts=[]
 for i,l in enumerate(segment):
  for m in re.finditer('[①②③④]',l['text']):starts.append((i,m.start(),'①②③④'.index(m.group())))
 # Find the final complete ordered option run; insertion position markers can
 # otherwise look like option digits inside the passage.
 first=None
 for j in range(len(starts)-3):
  if [x[2] for x in starts[j:j+4]]==[0,1,2,3]:first=starts[j];break
 if first is None:return segment,[],None
 idx=first[0]
 options=['','','','']; current=None
 for l in segment[idx:]:
  parts=re.split('([①②③④])',l['text'])
  for part in parts:
   if part in list('①②③④'):current='①②③④'.index(part)
   elif current is not None and part.strip():options[current]+=(' ' if options[current] else '')+part.strip()
 return segment[:idx],[clean(o) for o in options],segment[idx]

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 corrections=json.loads((OUT/'corrections.json').read_text()) if (OUT/'corrections.json').exists() else {}
 for cp in sorted(OUT.glob('corrections-*.json')):
  if cp.stem.endswith('-notes'):continue
  for gid,patch in json.loads(cp.read_text()).items():
   original=corrections.setdefault(gid,{})
   for key,value in patch.items():
    if key=='questions':original.setdefault('questions',{}).update(value)
    else:original[key]=value
 keys=json.loads((SOURCE/'answer-keys.json').read_text()) if (SOURCE/'answer-keys.json').exists() else {}
 review96=json.loads((SOURCE/'96-review.json').read_text()) if (SOURCE/'96-review.json').exists() else {}
 if review96:
  keys['96']={n:q['answer1based'] for n,q in review96['questions'].items() if q['answer1based'] is not None}
 groups=[]; issues=[]; summaries=[]
 for folder in sorted(SOURCE.iterdir(),key=lambda p:int(p.name) if p.name.isdigit() else 9999):
  if not folder.name.isdigit():continue
  exam=int(folder.name); lines=[]; pages={}
  for p in sorted((folder/'reading').glob('page-*.json')):
   d=json.loads(p.read_text());pages[d['pdfPage']]=d
   if d['isFrontMatter']:continue
   page_lines=[{**l,'text':html.unescape(l.get('textWithUnderlines',l['text']))} for l in d['lines']]
   # The 4 stimulus graphics on printed page2 have fixed vertical rows. Vision
   # sometimes misses a question number altogether; interpolate from the visible
   # numbers, preserving their actual source positions instead of losing items.
   if d['sectionPage']==2:
    known=[]
    for l in page_lines:
     t=l['text'].strip()
     if l['bbox']['x']<.19:
      m=re.fullmatch(r'([5-8])[.．]?',t)
      if m:known.append((int(m[1]),l['bbox']['y']))
      elif t in ['ㄱ.','?.','ㄱ']:known.append((7,l['bbox']['y']))
    diffs=[(b[1]-a[1])/(b[0]-a[0]) for a,b in zip(sorted(known),sorted(known)[1:]) if b[0]>a[0]]
    step=statistics.median(diffs) if diffs else .19
    base=statistics.median([y-(n-5)*step for n,y in known]) if known else .145
    page_lines=[l for l in page_lines if not(l['bbox']['x']<.19 and re.fullmatch(r'(?:[5-8]|ㄱ|\?)[.．]?',l['text'].strip()))]
    for n in range(5,9):page_lines.append({'text':f'{n}.','confidence':1,'bbox':{'x':.14,'y':dict(known).get(n,base+(n-5)*step),'width':.018,'height':.016}})
   if exam==36 and d['pdfPage']==24:
    page_lines.append({'text':'14.','confidence':1,'bbox':{'x':.16,'y':.391,'width':.018,'height':.016}})
   if exam==91 and d['pdfPage']==21:
    page_lines.append({'text':'40.','confidence':1,'bbox':{'x':.14,'y':.121,'width':.018,'height':.016}})
   for l in rows(page_lines):
    if l['bbox']['y']<.065 or l['bbox']['y']>.91:continue
    if '한국어능력시험' in l['text'] or 'TOPIK' in l['text']:continue
    if re.search('Test of|Proficiency|Proiciency',l['text'],re.I):continue
    if .43<l['bbox']['x']<.56 and re.fullmatch(r'\d{1,2}|∞',l['text'].strip()) and l['bbox']['y']>.86:continue
    if exam==64 and l['text']=='3%' and l['bbox']['x']<.19:l={**l,'text':'37.'}
    lines.append({**l,'page':d['pdfPage']})
  anchors={}; headers=[]; expected=1
  for i,l in enumerate(lines):
   t=l['text'].strip()
   if re.search(r'[\[【]\s*\d+\s*[~～\-–]\s*\d+\s*[\]】]',t) or (t.startswith('※') and re.search(r'\d+\s*[~～]',t)):headers.append(i)
   if l['bbox']['x']>.19:continue
   # One printed 7 was read as ㄱ. Standalone numeric anchors can lose periods.
   if t in ['ㄱ.','ㄱ','フ.'] and expected==7:n=7
   else:
    m=re.match(r'^(\d{1,2})(?:[.．]\s*|\s+|$)',t)
    if not m:continue
    n=int(m.group(1))
   if n<expected or n>50:continue
   if n!=expected:issues.append({'exam':exam,'problem':'anchor-gap','expected':expected,'found':n,'page':l['page']})
   anchors[n]=i;expected=n+1
  prepared={}
  for n,start in anchors.items():
   stop=min([i for i in [*anchors.values(),*headers] if i>start],default=len(lines))
   segment=[{**l} for l in lines[start:stop]]
   segment[0]['text']=re.sub(r'^\s*(?:\d{1,2}|ㄱ|フ)[.．]?\s*','',segment[0]['text'])
   is_insertion=n in [39,40,41] or (n==46 and '들어가기에' in join(segment))
   body,options,first_option=split_options(segment,is_insertion)
   if len(options)!=4 or any(not o for o in options):issues.append({'exam':exam,'question':n,'problem':'options','page':lines[start]['page'],'text':join(segment)})
   prepared[n]={'body':body,'options':options,'firstOption':first_option,'start':start,'segment':segment,'insertion':is_insertion}
  used=set()
  for n in anchors:
   if n in used:continue
   shared=next(((a,b) for a,b in SHARED if a<=n<=b),None)
   numbers=list(range(shared[0],shared[1]+1)) if shared else [n]
   if any(k not in prepared for k in numbers):
    issues.append({'exam':exam,'question':n,'problem':'incomplete-shared-group'});continue
   used.update(numbers)
   gid=f'topik-{exam}-r-'+ '-'.join(map(str,numbers))
   cat=category(n); first=prepared[n]; passage='';blocks=[]; shared_lines=[]
   if shared:
    h=max((i for i in headers if i<first['start']),default=-1)
    shared_lines=lines[h+1:first['start']]
    # Header continuation is not passage text.
    while shared_lines and ('고르십시오' in shared_lines[0]['text'] or re.match(r'^\(?각\s*2점',shared_lines[0]['text'])):shared_lines=shared_lines[1:]
    passage=join(shared_lines,True)
    blocks=[{'type':'box','text':passage}] if passage else []
   elif n>=5:
    body=first['body']; passage=join(body,True)
    if n in range(5,11):
     d=pages[lines[first['start']]['page']]
     top=lines[first['start']]['bbox']['y']-.008
     bottom=first['firstOption']['bbox']['y']-.012 if first['firstOption'] else top
     # Crop only the stimulus, with its original graphic arrangement. Its full
     # recognized content is also stored as group.passage for search/accessibility.
     if bottom>top:
      image=Image.open(ROOT/d['imagePath']);w,h=image.size
      asset=f'/topik-assets/{exam}/q{n:02d}.webp';target=ROOT/'public'/asset.lstrip('/');target.parent.mkdir(parents=True,exist_ok=True)
      left=.20 if exam in [36,60,64] else .17
      image.crop((int(left*w),int(top*h),int(.89*w),int(bottom*h))).save(target,'WEBP',quality=95)
      blocks=[{'type':'image','src':asset,'alt':passage}]
     else:issues.append({'exam':exam,'question':n,'problem':'image-crop'})
    elif n in range(39,42):
     parts=re.split(r'[-—_]?\s*<?보\s*기>?',passage,maxsplit=1)
     if len(parts)>1:
      passage=parts[0].strip(); blocks=[{'type':'text','text':passage},{'type':'box','text':parts[1].strip()}]
     else:
      content_lines=[l for l in body if l['text'].strip()]
      split=next((i for i in range(1,len(content_lines)) if content_lines[i]['bbox']['y']-(content_lines[i-1]['bbox']['y']+content_lines[i-1]['bbox']['height'])>.015),None)
      if split:
       stimulus=join(content_lines[:split]);passage=join(content_lines[split:]);blocks=[{'type':'box','text':stimulus},{'type':'text','text':passage}]
      else:blocks=[{'type':'text','text':passage}];issues.append({'exam':exam,'question':n,'problem':'insertion-stimulus'})
    else:blocks=[{'type':'box','text':passage}]
   withheld=bool(re.search('저작권 관련 법령|Copyright Act|NOT disclosed|공개하지 않',passage,re.I))
   qs=[]
   for num in numbers:
    part=prepared[num];qid=f'topik-{exam}-r-{num:02d}'
    answer=keys.get(str(exam),{}).get(str(num))
    prompt=join(part['body'],True) if shared or num<=4 else ''
    options=part['options']
    if part['insertion']:options=['ㄱ','ㄴ','ㄷ','ㄹ']
    if answer is not None and not 1<=answer<=4:raise ValueError(f'Bad key {exam}:{num}')
    q={'id':qid,'number':num,'prompt':prompt,'options':options,'answer':answer-1 if answer else None,
       'explanation':f'{exam}회 TOPIK II 읽기 javob kaliti: {answer}-variant.' if answer else 'Javob kaliti tekshirilmoqda.',
       'verified':answer is not None and len(options)==4 and all(options),'withheld':withheld}
    if exam==96 and str(num) in review96.get('questions',{}) and answer:
     q['explanation']=review96['questions'][str(num)]['explanationUz']
    qs.append(q)
   source_pages=sorted({l['page'] for num in numbers for l in prepared[num]['segment']} | {l['page'] for l in shared_lines})
   g={'id':gid,'category':cat,'origin':'official','source':{'exam':exam,'file':next(iter(pages.values()))['sourceName'],'pages':source_pages},
      'instruction':INSTRUCTIONS.get(cat,'다음을 읽고 물음에 답하십시오.'),'passage':passage,'blocks':blocks,'questions':qs}
   # Position questions always have four ordered insertion slots; normalize
   # circled Hangul that OCR mistakes for circled digits/Latin letters.
   if first['insertion']:
    slot=[0]
    def marker(m):
     if slot[0]>=4:return m.group()
     value='( '+ 'ㄱㄴㄷㄹ'[slot[0]]+' )';slot[0]+=1;return value
    for b in g['blocks']:
     if b['type']=='text' or (n==46 and b['type']=='box'):
      text=b.get('text','')
      # Visually checked against83회 readingPDFp21: Vision omitted the final
      # stand-alone circledㄹ line at the bottom of the passage box.
      if exam==83 and n==41 and b['type']=='text':text+=' ( )'
      # Known small circled-Hangul recognition artifacts; restore just the
      # position token, never infer missing Korean prose.
      text=re.sub(r'\(\s*(?:봣⑦|그|르)\s*\)', '( )',text)
      text=re.sub(r'\(\s*ㄱ\s+(?=[가-힣])','( ) ',text)
      text=re.sub(r'\(\s*$','( )',text)
      # A lone closing parenthesis after a completed sentence is a dropped
      # insertion-token opening bracket. It is visibly a slot in the source.
      text=re.sub(r'([.?!])\s*\)(?=\s|$)',r'\1 ( )',text)
      b['text']=re.sub(r'\(\s*[^가-힣()]{0,5}\s*\)',marker,text)
    g['passage']='\n'.join(b.get('text','') for b in g['blocks'])
    if slot[0]!=4:issues.append({'exam':exam,'question':n,'problem':'insertion-markers','count':slot[0]})
   patch=corrections.get(gid,{})
   for key,value in patch.items():
    if key!='questions':g[key]=value
   for q in g['questions']:
    q.update(patch.get('questions',{}).get(str(q['number']),{}))
   groups.append(g)
  summaries.append({'exam':exam,'anchors':len(anchors),'groups':sum(g['source']['exam']==exam for g in groups),'missing':[n for n in range(1,51) if n not in anchors]})
 (OUT/'official-groups.json').write_text(json.dumps(groups,ensure_ascii=False,indent=2)+'\n')
 generated=[]
 # User chose real reading questions with repetition and empty 42–43 slots.
 # Only the separately requested grammar exercises are authored additions.
 for filename in ['generated-grammar.json']:
  if (OUT/filename).exists():generated+=json.loads((OUT/filename).read_text())
 (OUT/'groups.json').write_text(json.dumps(groups+generated,ensure_ascii=False,indent=2)+'\n')
 report={'exams':summaries,'officialQuestions':sum(len(g['questions']) for g in groups),'generatedQuestions':sum(len(g['questions']) for g in generated),'issues':issues}
 (OUT/'assembly-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({**report,'issues':collections.Counter(i['problem'] for i in issues)},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
