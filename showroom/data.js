/* Шоу-рум Aru — список героинь и образов.
   Чтобы добавить героиню: положить фото в showroom/img/ и добавить блок ниже.
   video — номер ролика на YouTube (то, что после watch?v= или shorts/). Пусто — кнопки видео нет. */
window.SHOWROOM = [
  {
    id: "bibigul", age: 67,
    name: ["Бибигуль апа", "Бибігүл апа", "Bibigul apa"],
    voice: ["Я думала, в моём возрасте уже всё равно, что надеть. Серое, бежевое — «чтобы не выделяться». А потом увидела себя в сапфире и белом, и внучка сказала: «Апа, ты сияешь».", "Менің жасымда не кисем де бәрібір деп ойлайтынмын. Сұр, бежевый — «көзге түспеу үшін». Ал сапфир мен ақ түсте өзімді көргенде, немерем: «Апа, сіз жарқырап тұрсыз» деді.", "I thought at my age it no longer mattered what I wore. Grey, beige — “so as not to stand out”. Then I saw myself in sapphire and white, and my granddaughter said: “Apa, you’re glowing.”"],
    type: ["Холодная зима", "Суық қыс", "Cool Winter"],
    story: ["Седина, тёмные глаза, прохладный подтон. Серый и бежевый её «гасят», а чистые холодные цвета превращают седину в благородное серебро.",
            "Ақ шаш, қою көз, салқын реңк. Сұр мен бежевый оны солғындатады, ал таза салқын түстер ақ шашты асыл күміске айналдырады.",
            "Silver hair, dark eyes, cool undertone. Grey and beige dull her, while clear cool colours turn her grey hair into noble silver."],
    face: "img/bibigul-face.jpg", orig: "img/bibigul-orig.jpg",
    before: ["Серо-бежевый джемпер и коричневые брюки: тёплые пыльные цвета сливаются с сединой и добавляют возраст.",
             "Сұр-бежевый жемпір мен қоңыр шалбар: жылы шаңды түстер ақ шашпен араласып, жас қосады.",
             "Grey-beige jumper and brown trousers: warm dusty colours blend into her grey hair and add years."],
    looks: [
      { id: "work", t: ["Работа", "Жұмыс", "Work"], img: "img/bibigul-work.jpg", video: "b8uDaV9QEKA",
        items: [["Жакет — сапфир", "Жакет — сапфир", "Blazer — sapphire"], ["Блуза — белоснежная", "Блузка — аппақ", "Blouse — pure white"], ["Брюки — тёмно-синие", "Шалбар — қою көк", "Trousers — navy"], ["Украшения — серебро", "Әшекей — күміс", "Jewellery — silver"]],
        why: ["Сапфир и белый превращают седину в благородное серебро, лицо выглядит свежим и собранным.", "Сапфир мен ақ түс ақ шашты асыл күміске айналдырады, бет сергек көрінеді.", "Sapphire and white turn grey hair into noble silver; her face looks fresh and composed."] },
      { id: "party", t: ["Праздник", "Мереке", "Celebration"], img: "img/bibigul-party.jpg", video: "b8uDaV9QEKA",
        items: [["Платье миди — холодная малина", "Миди көйлек — суық таңқурай", "Midi dress — cool raspberry"], ["Палантин — серебристо-серый", "Палантин — күміс-сұр", "Wrap — silver grey"], ["Серьги с камнем — серебро", "Тасты сырға — күміс", "Stone earrings — silver"], ["Туфли — серебристые", "Туфли — күміс түсті", "Shoes — silver"]],
        why: ["Ягодный цвет даёт лицу румянец, а серебро перекликается с сединой.", "Жидек түсі бетке ұялық береді, ал күміс ақ шашпен үндеседі.", "Berry colour adds a flush; silver echoes her grey hair."] },
      { id: "weekend", t: ["Выходной", "Демалыс", "Weekend"], img: "img/bibigul-weekend.jpg", video: "b8uDaV9QEKA",
        items: [["Пальто — аметист", "Пальто — аметист", "Coat — amethyst"], ["Водолазка — жемчужная", "Водолазка — інжу", "Turtleneck — pearl grey"], ["Брюки и ботильоны — чёрные", "Шалбар мен бәтеңке — қара", "Trousers and boots — black"], ["Платок — фиолетово-серебристый", "Орамал — күлгін-күміс", "Scarf — violet and silver"]],
        why: ["Холодный фиолетовый — её цвет: аристократично и без возраста.", "Салқын күлгін — оның түсі: асыл әрі жассыз.", "Cool violet is her colour: aristocratic and ageless."] },
      { id: "sport", t: ["Спорт", "Спорт", "Sport"], img: "img/bibigul-sport.jpg", video: "b8uDaV9QEKA",
        items: [["Жилет — сапфир", "Жилет — сапфир", "Vest — sapphire"], ["Лонгслив — белый", "Лонгслив — ақ", "Long sleeve — white"], ["Брюки — тёмно-синие", "Шалбар — қою көк", "Trousers — navy"], ["Повязка — ягодная", "Таңғыш — жидек түсті", "Headband — berry"]],
        why: ["Даже на прогулке — свои цвета: бодро и ярко, без серого трикотажа.", "Серуенде де — өз түстері: сергек әрі жарқын.", "Her own colours even on a walk: lively and bright, no grey knitwear."] },
      { id: "gala", t: ["Торжество", "Салтанат", "Gala"], img: "img/bibigul-gala.jpg", video: "b8uDaV9QEKA",
        items: [["Бархатное платье в пол — изумруд", "Барқыт ұзын көйлек — зүмірет", "Velvet floor-length dress — emerald"], ["Серьги и колье — изумруды в серебре", "Сырға мен алқа — күмістегі зүмірет", "Earrings and necklace — emeralds in silver"], ["Туфли и клатч — серебро", "Туфли мен клатч — күміс", "Shoes and clutch — silver"]],
        why: ["Глубокий изумруд и серебро — королевское сочетание для седых волос.", "Терең зүмірет пен күміс — ақ шашқа патшалық үйлесім.", "Deep emerald and silver: a regal match for grey hair."] },
      { id: "toi", t: ["Той", "Той", "Toi"], img: "img/bibigul-national.jpg", video: "b8uDaV9QEKA",
        items: [["Камзол — тёмно-синий бархат с орнаментом", "Камзол — өрнекті қою көк барқыт", "Kamzol — navy velvet with ornament"], ["Платье — слоновая кость", "Көйлек — піл сүйегі түсті", "Dress — ivory"], ["Украшения — серебро с бирюзой", "Әшекей — көгілдір тасты күміс", "Jewellery — silver with turquoise"], ["Платок — белый шёлк", "Орамал — ақ жібек", "Shawl — white silk"]],
        why: ["Национальный наряд в её холодной гамме: торжественно и достойно.", "Ұлттық киім оның салқын түстерінде: салтанатты әрі сәнді.", "National dress in her cool palette: festive and dignified."] },
      { id: "summer", t: ["Лето", "Жаз", "Summer"], img: "img/bibigul-summer.jpg", video: "b8uDaV9QEKA",
        items: [["Платье — белый шифон в лавандовый цветок", "Көйлек — лаванда гүлді ақ шифон", "Dress — white chiffon, lavender print"], ["Шляпа — соломка с ягодной лентой", "Қалпақ — жидек лентасы бар сабан", "Hat — straw with berry ribbon"], ["Веер — белое кружево", "Желпуіш — ақ шілтер", "Fan — white lace"], ["Жемчуг и серебристые босоножки", "Інжу және күміс сандалий", "Pearls and silver sandals"]],
        why: ["Лёгкие холодные пастели освежают лицо даже в жару.", "Жеңіл салқын пастель ыстықта да бетті сергітеді.", "Light cool pastels freshen her face even in the heat."] }
    ]
  },
  {
    id: "elena", age: 30,
    name: ["Елена", "Елена", "Elena"],
    voice: ["Я носила серое и чёрное — думала, это практично. А на фото выглядела уставшей, даже после отпуска. Оказалось, мне идут пыльная роза и графит. Теперь коллеги спрашивают, что у меня случилось хорошего. А я просто нашла свои цвета — с моим стилистом Aru! Теперь вместе подбираем и образы, и причёски.", "Сұр мен қара киетінмін — ыңғайлы деп ойладым. Бірақ суретте демалыстан кейін де шаршаған болып көрінетінмін. Маған бозғылт раушан мен графит жарасады екен. Енді әріптестерім не жақсылық болғанын сұрайды. Ал мен жай ғана өз түстерімді таптым — Aru стилисімнің арқасында! Енді бірге бейне де, шаш үлгісін де таңдаймыз.", "I wore grey and black — I thought it was practical. But in photos I looked tired, even after a holiday. It turned out dusty rose and graphite suit me. Now colleagues ask what good news I’ve had. I simply found my colours — with my stylist Aru! Now we pick looks and hairstyles together."],
    type: ["Мягкое лето", "Жұмсақ жаз", "Soft Summer"],
    story: ["Пепельно-русые волосы, серо-голубые глаза, низкий контраст. Чёрный и серый её «гасят», приглушённые прохладные цвета освежают.",
            "Күлгін ақшыл шаш, сұр-көк көз, контраст төмен. Қара мен сұр оны солғындатады, бәсең салқын түстер сергітеді.",
            "Ash-brown hair, grey-blue eyes, low contrast. Black and grey dull her; muted cool colours freshen her."],
    face: "../app/img/elena-face.jpg", orig: "../app/img/elena-orig.jpg",
    before: ["Серый джемпер и тёмно-синие брюки: образ «гаснет», лицо выглядит бледным.", "Сұр жемпір мен қою көк шалбар: бейне солғын, бет бозғылт.", "Grey jumper and navy trousers: the look fades, her face looks pale."],
    looks: [
      { id: "work", t: ["Работа", "Жұмыс", "Work"], img: "../app/img/elena-work.jpg", video: "241hyX_LY6s",
        items: [["Жакет — графит", "Жакет — графит", "Blazer — graphite"], ["Блуза — пыльная роза", "Блузка — бозғылт раушан", "Blouse — dusty rose"], ["Брюки — серо-голубые", "Шалбар — сұр-көк", "Trousers — grey-blue"], ["Лоферы — тауп", "Лоферлер — тауп", "Loafers — taupe"]],
        why: ["Графит вместо чёрного не спорит с мягкой внешностью, пыльная роза освежает лицо.", "Қараның орнына графит жұмсақ келбетпен таласпайды, бозғылт раушан бетті сергітеді.", "Graphite instead of black suits her soft colouring; dusty rose freshens her face."] },
      { id: "party", t: ["Праздник", "Мереке", "Celebration"], img: "../app/img/elena-party.jpg", video: "241hyX_LY6s",
        items: [["Платье с запахом — мальва", "Орама көйлек — мальва", "Wrap dress — mauve"], ["Серьги-капли — серебро", "Тамшы сырға — күміс", "Drop earrings — silver"], ["Клатч — серый жемчуг", "Клатч — сұр інжу", "Clutch — pearl grey"]],
        why: ["Приглушённая ягодная мальва даёт лицу румянец и подчёркивает глаза.", "Бәсең жидек-мальва бетке ұялық береді, көзді ерекшелейді.", "Muted berry mauve adds a flush and brings out her eyes."] },
      { id: "weekend", t: ["Выходной", "Демалыс", "Weekend"], img: "../app/img/elena-weekend.jpg", video: "",
        items: [["Джемпер — серая лаванда", "Жемпір — сұр лаванда", "Jumper — lavender grey"], ["Тренч — серый камень", "Тренч — сұр тас", "Trench — stone grey"], ["Джинсы — светлый деним", "Джинсы — ашық деним", "Jeans — light denim"]],
        why: ["Спокойная прохладная гамма, в которой лицо выглядит отдохнувшим.", "Бет демалған болып көрінетін байсалды салқын гамма.", "A calm cool palette that keeps her face looking rested."] }
    ]
  },
  {
    id: "aigerim", age: 28,
    name: ["Айгерим", "Айгерім", "Aigerim"],
    voice: ["Шкаф полный, а надеть нечего — это про меня. Я брала то, что модно, а оно меня «гасило». Теперь я знаю свои цвета и собираюсь за десять минут — и на работу, и на той.", "Шкаф толы, бірақ киетін ештеңе жоқ — бұл мен туралы. Сәнді нәрселерді алатынмын, ал олар мені «сөндіретін». Енді өз түстерімді білемін, жұмысқа да, тойға да он минутта жиналамын.", "A full wardrobe and nothing to wear — that was me. I bought what was trendy, and it washed me out. Now I know my colours and get ready in ten minutes — for work or a toi."],
    type: ["Тёмная осень", "Қою күз", "Deep Autumn"],
    story: ["Тёмный каштан, карие глаза, тёплый подтон. Холодный серый её «гасит», глубокие тёплые цвета зажигают.",
            "Қою құба шаш, қоңыр көз, жылы реңк. Суық сұр оны солғындатады, терең жылы түстер жарқыратады.",
            "Dark chestnut hair, brown eyes, warm undertone. Cool grey dulls her; deep warm colours light her up."],
    face: "../app/img/aigerim-face.jpg", orig: "../app/img/aigerim-orig.jpg",
    before: ["Серый трикотаж и тёмные брюки: лицо выглядит уставшим.", "Сұр трикотаж бен қою шалбар: бет шаршаңқы көрінеді.", "Grey knit and dark trousers: her face looks tired."],
    looks: [
      { id: "work", t: ["Работа", "Жұмыс", "Work"], img: "../app/img/aigerim-work.jpg", video: "THhBkBmO23Y",
        items: [["Жакет — шоколад", "Жакет — шоколад", "Blazer — chocolate"], ["Блуза — горчица", "Блузка — қыша", "Blouse — mustard"], ["Брюки — олива", "Шалбар — зәйтүн", "Trousers — olive"], ["Лодочки — бежевая замша", "Туфли — беж күдері", "Pumps — beige suede"]],
        why: ["Шоколад вместо чёрного держит строгость, а горчица у лица подсвечивает карие глаза.", "Қараның орнына шоколад қатаңдықты сақтайды, қыша қоңыр көзді жарқыратады.", "Chocolate keeps it sharp instead of black; mustard lights up her brown eyes."] },
      { id: "party", t: ["Праздник", "Мереке", "Celebration"], img: "../app/img/aigerim-party.jpg", video: "THhBkBmO23Y",
        items: [["Платье миди — марсала", "Миди көйлек — марсала", "Midi dress — marsala"], ["Украшения — золото", "Әшекей — алтын", "Jewellery — gold"]],
        why: ["Марсала — праздничный цвет тёмной осени: торжественно и без резкости чёрного.", "Марсала — қою күздің мерекелік түсі.", "Marsala is Deep Autumn's festive colour."] },
      { id: "weekend", t: ["Выходной", "Демалыс", "Weekend"], img: "../app/img/aigerim-weekend.jpg", video: "THhBkBmO23Y",
        items: [["Свитер — терракота", "Жемпір — терракота", "Knit — terracotta"], ["Шарф — хвоя", "Шарф — қылқан", "Scarf — pine"], ["Джинсы — тёмный деним", "Джинсы — қою деним", "Jeans — dark denim"]],
        why: ["Терракота даёт лицу тёплый румянец, хвойный шарф делает образ глубже.", "Терракота бетке жылы ұялық береді.", "Terracotta adds a warm glow; the pine scarf adds depth."] }
    ]
  },
  {
    id: "alisa", age: 19,
    name: ["Алиса", "Алиса", "Alisa"],
    voice: ["Я жила в худи горчичного цвета — удобно же. А на фото была бледная, как будто не спала неделю. Aru сказал: мне идут лаванда, пудрово-голубой и пыльная роза. Теперь подруги спрашивают, что я с собой сделала.", "Мен қыша түсті худиден шықпайтынмын — ыңғайлы ғой. Бірақ суретте апта бойы ұйықтамағандай боп-боз едім. Aru маған лаванда, ақшыл көгілдір және бозғылт раушан жарасатынын айтты. Енді құрбыларым не істегенімді сұрайды.", "I lived in a mustard hoodie — it is comfy. But in photos I looked pale, as if I had not slept for a week. Aru said lavender, powder blue and dusty rose suit me. Now my friends ask what I did to myself."],
    type: ["Светлое лето", "Ашық жаз", "Light Summer"],
    story: ["Светлые пепельные волосы, серо-голубые глаза, светлая холодная кожа, низкий контраст. Тёплая горчица делает её бледной и усталой, а нежные холодные пастели дают лицу свет.",
            "Ашық күлгін шаш, сұр-көк көз, ақшыл салқын тері, контраст төмен. Жылы қыша түсі оны бозартады, ал нәзік салқын пастель бетке жарық береді.",
            "Light ash hair, grey-blue eyes, fair cool skin, low contrast. Warm mustard makes her pale and tired, while soft cool pastels light up her face."],
    face: "img/alisa-face.jpg", orig: "img/alisa-orig.jpg",
    before: ["Горчичное худи оверсайз и чёрные легинсы: тёплый жёлтый спорит с холодной кожей, лицо выглядит серым и уставшим.",
             "Қыша түсті оверсайз худи мен қара легинс: жылы сары салқын терімен таласады, бет сұрғылт әрі шаршаған.",
             "Oversized mustard hoodie and black leggings: warm yellow clashes with her cool skin, her face looks grey and tired."],
    looks: [
      { id: "study", t: ["Учёба", "Оқу", "Study"], img: "img/alisa-work.jpg", video: "",
        items: [["Рубашка — пудрово-голубая", "Жейде — ақшыл көгілдір", "Shirt — powder blue"], ["Жилет — светло-серый", "Жилет — ашық сұр", "Vest — light grey"], ["Брюки — белые широкие", "Шалбар — ақ, кең", "Trousers — white wide-leg"], ["Серьги — серебро", "Сырға — күміс", "Earrings — silver"]],
        why: ["Голубой и светло-серый у лица освежают холодную кожу, серебро перекликается с пепельными волосами.", "Бетке жақын көгілдір мен ашық сұр салқын теріні сергітеді, күміс күлгін шашпен үндеседі.", "Blue and light grey near the face freshen her cool skin; silver echoes her ash hair."] },
      { id: "party", t: ["Праздник", "Мереке", "Celebration"], img: "img/alisa-party.jpg", video: "",
        items: [["Платье-комбинация — лаванда", "Комбинация көйлек — лаванда", "Slip dress — lavender"], ["Цепочка и серьги — серебро", "Шынжыр мен сырға — күміс", "Chain and earrings — silver"], ["Клатч — жемчужный", "Клатч — інжу", "Clutch — pearl"]],
        why: ["Лаванда — её праздничный цвет: нежно, дорого и подчёркивает серо-голубые глаза.", "Лаванда — оның мерекелік түсі: нәзік, сәнді әрі сұр-көк көзді ерекшелейді.", "Lavender is her party colour: soft, elegant and it brings out her grey-blue eyes."] },
      { id: "weekend", t: ["Выходной", "Демалыс", "Weekend"], img: "img/alisa-weekend.jpg", video: "",
        items: [["Свитер — пыльная роза", "Свитер — бозғылт раушан", "Sweater — dusty rose"], ["Рубашка — мятная", "Жейде — жалбыз", "Overshirt — mint"], ["Джинсы — светлые", "Джинсы — ашық", "Jeans — light wash"]],
        why: ["Пыльная роза даёт лицу румянец, мята и светлый деним сохраняют лёгкость.", "Бозғылт раушан бетке ұялық береді, жалбыз бен ашық деним жеңілдік сақтайды.", "Dusty rose adds a flush; mint and light denim keep it light."] }
    ]
  }
];
