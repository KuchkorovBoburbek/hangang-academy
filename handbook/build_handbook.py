from pathlib import Path
from math import ceil
from html import escape
import re,json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from content import A,B,C,D
ROOT=Path('/Users/boburbek/Documents/ChatGPT/Hangang_Academy')
OUT=ROOT/'output/pdf/HangangAcademy_TOPIK_II_Grammatika_1-4.pdf'
FONT='/Users/boburbek/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype/'
pdfmetrics.registerFont(TTFont('Sans',FONT+'NotoSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Bold',FONT+'NotoSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Korean','/System/Library/Fonts/Supplemental/Arial Unicode.ttf'))
pdfmetrics.registerFontFamily('Sans',normal='Sans',bold='Bold')
LOGO=ImageReader('/Users/boburbek/Desktop/TOPIK_2/hangang_academy.png')
W,H=595.276,841.89; M=43; CW=W-2*M
NAVY=HexColor('#12304B'); BLUE=HexColor('#0877BC'); CYAN=HexColor('#03ADD6'); TEXT=HexColor('#253C4D'); GREY=HexColor('#617587'); LINE=HexColor('#DCE7EC'); PALE=HexColor('#F0F8FC')
GROUPS=[('A','Bog‘lovchi shakllar','읽기 1-2 · 연결어미',A,'15-16'),('B','Gap yakunidagi shakllar','읽기 1-2 · 종결 표현',B,'16-17'),('C','O‘xshash ma’noli grammatikalar','읽기 3-4 · 유사 문법',C,'21-24'),('D','Qo‘shimcha shakllar','Test variantlari va izohlardan',D,'14, 16, 18-19, 25')]
start=6; pagemap={}
for code,title,sub,items,src in GROUPS:
 for i,it in enumerate(items): pagemap[it['id']]=start+i//3
 start+=ceil(len(items)/3)
TOTAL=start
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('HangangAcademy | TOPIK II 읽기 1-4 | Grammatika qo‘llanmasi')
c.setAuthor('HangangAcademy')
c.setSubject('합격 레시피 14-25-betlaridagi grammatika inventari asosida o‘zbekcha qo‘llanma')
qa=[]

def mixed(t):
 t=escape(t)
 return re.sub(r'([\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]+)',r'<font name="Korean">\1</font>',t)
def p(t,x,y,width=CW,size=10.8,leading=14.8,color=TEXT,font='Sans',markup=False):
 st=ParagraphStyle('x',fontName=font,fontSize=size,leading=leading,textColor=color,spaceAfter=0,allowWidows=0,allowOrphans=0)
 pp=Paragraph(t if markup else mixed(t),st)
 _,h=pp.wrap(width,1000)
 pp.drawOn(c,x,y-h)
 return y-h

def line(y,x=M,width=CW):
 c.setStrokeColor(LINE);c.setLineWidth(.65);c.line(x,y,x+width,y)

def background(page,section=''):
 c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
 c.saveState();c.setFillAlpha(.047);c.drawImage(LOGO,238,219,width=355,height=355,mask='auto');c.restoreState()
 c.saveState();c.setFillColor(HexColor('#EEF7FB'));c.setFont('Bold',33);c.drawCentredString(374,281,'HangangAcademy');c.restoreState()
 c.setFillColor(CYAN);c.rect(M,H-42,21,3,fill=1,stroke=0)
 c.setFillColor(NAVY);c.setFont('Bold',9);c.drawString(M+30,H-42,'HangangAcademy')
 c.setFillColor(GREY);c.setFont('Sans',8);c.drawRightString(W-M,H-42,'TOPIK II  /  읽기 1-4' if False else 'TOPIK II  /  GRAMMATIKA')
 line(56)
 c.setFont('Sans',7.6);c.setFillColor(GREY);c.drawString(M,39,section or 'Mustaqil o‘rganish uchun qo‘llanma')
 c.setFont('Bold',8.5);c.setFillColor(NAVY);c.drawRightString(W-M,39,f'{page:02} / {TOTAL:02}')

def heading(kicker,title,sub=None):
 p(kicker.upper(),M,H-75,size=8.2,leading=11,color=BLUE,font='Bold')
 y=p(title,M,H-96,size=22,leading=29,color=NAVY,font='Bold')
 if sub:p(sub,M,y-8,size=10.2,leading=14,color=GREY)

def index_row(item,x,y,w):
 c.setFillColor(BLUE);c.setFont('Bold',8.4);c.drawString(x,y-11,item['id'])
 fs=10.5
 while pdfmetrics.stringWidth(item['form'],'Korean',fs)>w-68: fs-=.2
 c.setFillColor(TEXT);c.setFont('Korean',fs);c.drawString(x+31,y-11,item['form'])
 c.setFillColor(GREY);c.setFont('Sans',8.4);c.drawRightString(x+w,y-11,str(pagemap[item['id']]))
 c.linkRect('',item['id'],(x,y-17,x+w,y+2),relative=0,thickness=0)

# Cover
c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
c.saveState();c.setFillAlpha(.12);c.drawImage(LOGO,94,113,width=650,height=650,mask='auto');c.restoreState()
c.setFillColor(CYAN);c.rect(47,743,34,4,fill=1,stroke=0)
p('HangangAcademy',47,722,size=14,leading=19,color=BLUE,font='Bold')
p('KOREYS TILI  /  O‘QUV QO‘LLANMA',47,692,size=8.8,leading=13,color=GREY,font='Bold')
p('TOPIK II',44,628,size=53,leading=62,color=NAVY,font='Bold')
p('읽기 1-4',47,558,size=37,leading=48,color=BLUE,font='Korean')
p('Grammatika\nqo‘llanmasi'.replace('\n','<br/>'),47,486,width=490,size=32,leading=43,color=NAVY,font='Bold',markup=True)
p('Shakl · ma’no · misol · farqlar',49,374,width=460,size=12.3,leading=18,color=GREY)
line(306,49,460)
for x,num,label in [(49,'30','bog‘lovchi shakl'),(217,'20','yakuniy shakl'),(385,'40','o‘xshashlik guruhi')]:
 p(num,x,279,width=155,size=30,leading=36,color=BLUE,font='Bold');p(label,x,239,width=155,size=9.6,leading=14,color=GREY)
p('+ 21 ta qo‘shimcha shakl',49,185,size=12,leading=18,color=NAVY,font='Bold')
p('Koreyscha misollar va o‘zbekcha izohlar bilan',49,158,size=11,leading=16,color=GREY)
p('«TOPIK II 합격 레시피» kitobining 14-25-betlaridagi grammatika ro‘yxatlari asosida qayta tuzildi.',49,95,width=460,size=9,leading=14,color=GREY,markup=False)
c.showPage()
# Guidance
background(2,'Qo‘llanmadan foydalanish')
heading('Boshlashdan oldin','Qo‘llanmani qanday ishlatish kerak?')
y=H-159
for title,body in [
('1-2-savollar: mos shaklni toping','Gapning ikki qismi o‘rtasidagi bog‘lanishni aniqlang: sababmi, maqsadmi, shartmi, ketma-ketlikmi? So‘ng zamon va gap egasini tekshiring. A va B bo‘limlari shu mashq uchun.'),
('3-4-savollar: ma’noni saqlang','Tagi chizilgan ifodaning vazifasini toping va shu gapda ma’nosi yaqin variantni tanlang. C bo‘limidagi yaqin shakllar har qanday gapda avtomatik ravishda almashmaydi.'),
('Har bir bandni uch qadamda o‘rganing','Shakl va ma’noni o‘qing, koreyscha misolni tarjimasiz tushunishga harakat qiling, so‘ng o‘zingiz bitta gap tuzing. «Eslatma» qismi ko‘p uchraydigan chalkashlikni ajratadi.')]:
 y=p(title,M,y,size=13,leading=18,color=NAVY,font='Bold')-7
 y=p(body,M,y,size=11.1,leading=16)-22
line(y+7);y-=15
p('Belgilashlar',M,y,size=13,leading=18,color=NAVY,font='Bold');y-=30
for title,body in [('V','Harakat fe’li: 가다, 먹다.'),('A','Sifat/holat fe’li: 좋다, 크다.'),('N','Ot: 학생, 학교.'),('(으)','O‘zak oxiriga qarab tanlanadi: 가려고, 먹으려고. ㄹ bilan tugagan va noto‘g‘ri tuslanuvchi o‘zaklarda alohida qoida bo‘lishi mumkin.'),('≈','Shu kontekstda ma’nosi yaqin; barcha holatlarda teng degani emas.')]:
 p(title,M,y,width=40,size=10.7,leading=15,color=BLUE,font='Bold')
 y=p(body,M+44,y,width=CW-44,size=10.4,leading=15)-8
p('Qamrov',M,179,size=12.5,leading=17,color=NAVY,font='Bold')
p('Asosiy ro‘yxatda 30 + 20 + 40 = 90 band bor. Ayrim shakllar turli vazifada takrorlanadi, shuning uchun bu 90 ta mutlaqo alohida grammatika degani emas. D bo‘limidagi 21 band shu sahifalarning test variantlari va eslatmalaridan olindi.',M,152,size=10.4,leading=15)
c.showPage()
# Main A+B index
background(3,'Mundarija · A va B')
heading('Mundarija','1-2-savollar uchun','Band ustiga bosib, tegishli sahifaga o‘tishingiz mumkin.')
colw=(CW-29)/2
p('A  Bog‘lovchi shakllar',M,681,width=colw,size=12,leading=17,color=BLUE,font='Bold')
p('B  Gap yakunidagi shakllar',M+colw+29,681,width=colw,size=11.7,leading=17,color=BLUE,font='Bold')
for i,it in enumerate(A):index_row(it,M,651-i*18.5,colw)
for i,it in enumerate(B):index_row(it,M+colw+29,651-i*18.5,colw)
p('Manba tartibi saqlangan.\nBo‘limlar ichidagi raqamlar kitobdagi asosiy ro‘yxatlarga mos.'.replace('\n',' '),M+colw+29,235,width=colw,size=10.4,leading=16,color=GREY)
c.showPage()
background(4,'Mundarija · C')
heading('Mundarija','3-4-savollar uchun','C  O‘xshash ma’noli grammatikalar: 40 guruh')
for i,it in enumerate(C):
 col=i//20;row=i%20;index_row(it,M+col*(colw+29),671-row*26,colw)
p('Eslatma: yaqin ifodani tanlashda butun gapni, zamonni va so‘zlovchining munosabatini tekshiring.',M,112,size=10.6,leading=15,color=GREY)
c.showPage()
background(5,'Mundarija · D va manba')
heading('Mundarija','Qo‘shimcha shakllar','D  Testlarda javob variantlari sifatida ham uchraydi')
for i,it in enumerate(D):index_row(it,M,668-i*22.5,CW)
p('Manba va qamrov qaydi',M,153,size=12,leading=18,color=BLUE,font='Bold')
p(f'Kitob sahifalari, mazmunning qayta ishlanishi va qamrov izohi: {TOTAL}-bet.',M,123,size=10.8,leading=16)
c.linkRect('','sources',(M,104,W-M,159),relative=0,thickness=0)
c.showPage()
# Content cards
page=6
for code,title,sub,items,src in GROUPS:
 for offset in range(0,len(items),3):
  batch=items[offset:offset+3]
  background(page,f'{code} · {title}')
  heading(f'{code} BO‘LIM / {offset+1:02}-{min(offset+3,len(items)):02}',title,f'{sub}  |  Manba: {src}-betlar')
  for j,it in enumerate(batch):
   top=H-151-j*208
   c.bookmarkHorizontalAbsolute(it['id'],top)
   if offset==0 and j==0:c.addOutlineEntry(title,it['id'],level=0,closed=False)
   c.addOutlineEntry(it['id']+' '+it['form'],it['id'],level=1,closed=False)
   c.setFillColor(BLUE);c.roundRect(M,top-23,35,22,5,fill=1,stroke=0)
   p(it['id'],M+5.5,top-5,width=25,size=9.2,leading=12,color=white,font='Bold')
   title_size=15.8
   if pdfmetrics.stringWidth(it['form'],'Korean',title_size)>CW-48:title_size=14.2
   y=p(it['form'],M+47,top-1,width=CW-47,size=title_size,leading=22,color=NAVY,font='Korean')-7
   y=p(it['meaning'],M,y,size=11.5,leading=16.0)-5
   label='Yaqin shakllar: ' if code=='C' else 'Tuzilishi: '
   y=p('<font name="Bold" color="#0877BC">'+label+'</font>'+mixed(it['syntax']),M,y,size=10.5,leading=15.3,markup=True)-7
   y=p(it['ko'],M+10,y,width=CW-20,size=13.3,leading=19.0,color=NAVY,font='Korean')-3
   y=p(it['uz'],M+10,y,width=CW-20,size=11.1,leading=15.7,color=GREY)-6
   y=p('<font name="Bold">Eslatma. </font>'+mixed(it['note']),M,y,size=10.15,leading=14.5,color=GREY,markup=True)
   bottom=top-193
   qa.append({'id':it['id'],'page':page,'end':round(y,2),'min_end':round(bottom,2),'slack':round(y-bottom,2)})
   if y<bottom-2: print('OVERFLOW',it['id'],round(y-bottom,2))
   if j<2:line(top-199)
  c.showPage();page+=1
# Source note
background(page,'Manba va qamrov')
c.bookmarkPage('sources');c.addOutlineEntry('Manba va qamrov','sources',level=0)
heading('Nashr qaydi','Manba va qamrov')
y=H-157
for title,body in [
('Asosiy manba','이태환. TOPIK II 합격 레시피. 한글파크, 2019. Foydalanuvchi taqdim etgan PDF nusxaning 14-25-betlari. Ushbu oraliqda PDF sahifa raqami va kitobda bosilgan sahifa raqami mos keladi.'),
('A bo‘lim: 30 band','15-16-betlar, 읽기 1번-2번 / 연결어미 ro‘yxati. Asosiy shakllar va ularning kitobdagi ketma-ketligi saqlandi.'),
('B bo‘lim: 20 band','16-17-betlar, 읽기 1번-2번 / 종결어미 ro‘yxati. Shakllar o‘rganish uchun umumiy lug‘aviy ko‘rinishda berildi: masalan, -기로 했다 → -기로 하다.'),
('C bo‘lim: 40 guruh','21-24-betlar, 읽기 3번-4번 / 유사 문법 ro‘yxati. Kitobda solishtirilgan yaqin ifodalar kiritildi. Ularning almashishi kontekstga bog‘liq ekaniga izoh berildi.'),
('D bo‘lim: 21 qo‘shimcha band','14, 18-19 va 25-betlardagi test variantlari hamda 16-betdagi eslatmadan olindi. A, B yoki C da tushuntirilgan shakllar D da qayta takrorlanmadi.'),
('Qayta ishlangan mazmun','O‘zbekcha ma’nolar, tarjimalar, qo‘llanish izohlari va koreyscha o‘quv misollari ushbu qo‘llanma uchun tuzildi. Asl kitobdagi testlarning to‘liq matni bu qo‘llanmaga kiritilmagan. Logotip foydalanuvchi taqdim etgan fayldan olindi.'),
('Qo‘llanmaning chegarasi','Bu qo‘llanma taqdim etilgan kitobning ko‘rsatilgan bo‘limlarini qamraydi. U barcha kelajakdagi TOPIK savollarida uchrashi mumkin bo‘lgan grammatikalarning mutlaq yoki rasmiy ro‘yxati emas. Kitobdagi chastota reytingi yangi statistik tekshiruv sifatida taqdim etilmaydi.')]:
 y=p(title,M,y,size=11.5,leading=16,color=NAVY,font='Bold')-5
 y=p(body,M,y,size=10.15,leading=14.5)-15
assert page==TOTAL,(page,TOTAL)
c.save()
(ROOT/'tmp/pdfs/layout_qa.json').write_text(json.dumps(qa,indent=2))
print('OUTPUT',OUT,'PAGES',TOTAL,'CARDS',len(qa),'MIN_SLACK',min(a['slack'] for a in qa))
