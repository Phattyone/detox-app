/* ── AFFILIATE CONFIGURATION ──────────────────────────────────────────────────
   Add your Amazon affiliate tag here. Replace YOUR_TAG with your actual tag
   (e.g. "detoxguide-20"). Once set, ALL 71+ Amazon links in this file will
   automatically include your affiliate tag.
   Sign up at: https://affiliate-program.amazon.com
   ─────────────────────────────────────────────────────────────────────────── */
const AFFILIATE_TAG = "YOUR_TAG-20"; // ← Replace with your Amazon affiliate tag

function amazonUrl(url) {
  if (!AFFILIATE_TAG || AFFILIATE_TAG === "YOUR_TAG-20") return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}tag=${AFFILIATE_TAG}`;
}

const RECIPE_DATA = {

  "pre-cleanse": {
    id: "pre-cleanse",
    title: "Pre-Cleanse Meal",
    subtitle: "The Night Before Day 1",
    icon: "🍽️",
    time: "~40 min",
    method: "Baked / Grilled / Sous Vide",
    color: "#3D6B8C",
    why: "A calm, satisfying meal that begins preparing your body. Salmon provides omega-3s and clean protein. Asparagus is a natural diuretic that starts flushing the system. Black rice digests slowly, keeping you full and stable through your first cleanse morning.",
    slots: [
      {
        id: "salmon",
        name: "Salmon Method",
        why: "Clean protein and omega-3s. Method affects texture and timing.",
        options: [
          {
            value: "Baked",
            instruction: "BAKED: Preheat oven to 400°F. Place salmon on a lightly oiled baking sheet, skin side down. Season with sea salt and black pepper. Bake 12-15 minutes until the fish flakes easily with a fork at the thickest part. Do not overcook - salmon continues cooking from residual heat. Rest 2 minutes before plating.",
            note: "Most hands-off method - great for multitasking with rice and asparagus."
          },
          {
            value: "Grilled",
            instruction: "GRILLED: Heat grill or grill pan to medium-high. Brush salmon lightly with olive oil, season with sea salt and pepper. Place skin-side up first. Grill 4-5 minutes per side until cooked through with visible grill marks. The salmon is done when it flakes easily at the thickest point. Rest 2 minutes before plating.",
            note: "Most flavorful through caramelization. A stovetop grill pan works perfectly."
          },
          {
            value: "Sous Vide",
            instruction: "SOUS VIDE: Set immersion circulator to 125°F for medium-rare or 130°F for medium. Season salmon, seal in a bag, submerge. Cook 45 minutes. When done, optionally finish with a quick 30-second sear in a very hot dry pan for a light crust. Rest 1 minute before plating.",
            note: "Most precise result. Requires an immersion circulator. Start this first - it takes longest."
          }
        ]
      },
      {
        id: "asparagus",
        name: "Asparagus Prep",
        why: "Natural diuretic - begins flushing the system before Day 1.",
        options: [
          {
            value: "Steamed",
            instruction: "STEAMED: Snap woody ends off asparagus where they naturally break. Steam over 1 inch of boiling purified water for 5-7 minutes until just tender with a slight bite. Do not overcook. Season lightly with sea salt and a squeeze of lemon.",
            note: "Best nutrient preservation. Best match for the Baked salmon method."
          },
          {
            value: "Roasted",
            instruction: "ROASTED: Preheat oven to 400°F. Spread asparagus in a single layer on a baking sheet. Drizzle very lightly with olive oil, season with sea salt and pepper. Roast 10-12 minutes until tender with slightly caramelized tips.",
            note: "Richest flavor through caramelization. Pairs with Baked or Grilled salmon."
          },
          {
            value: "Grilled",
            instruction: "GRILLED: Heat grill or grill pan to medium-high. Toss asparagus with a tiny amount of olive oil and season with sea salt and pepper. Grill 3-4 minutes turning once. Should have grill marks and be tender throughout.",
            note: "Cook alongside grilled salmon at the same time for efficiency."
          }
        ]
      }
    ],
    steps: [
      { title: "Cook Black Rice First", text: "Rinse 1/2 cup black rice. Combine with 1-1/4 cups purified water. Bring to boil, reduce to low, cover and simmer 30-35 minutes until water is absorbed. Remove from heat, rest covered 5 minutes. A rice cooker on the black rice setting also works." },
      { title: "Prepare the Salmon", text: "See your selected method above for step-by-step instructions." },
      { title: "Cook the Asparagus", text: "See your selected prep method above for step-by-step instructions." },
      { title: "Plate and Serve", text: "Serve salmon alongside asparagus and a generous scoop of black rice. Keep it simple. Eat slowly and mindfully. After dinner: soak prunes and almonds for tomorrow. Set out your supplements and shaker bottle." }
    ],
    tips: [
      "Soak 4-5 prunes in 1/2 cup purified water tonight - you need them for breakfast tomorrow.",
      "Sea salt is allowed ONLY for this pre-cleanse meal. Switch to sodium-free seasoning for all 7 cleanse days.",
      "Wild-caught salmon is preferable to farmed - lower toxin load, higher omega-3 content.",
      "Set out supplements and shaker bottle tonight so your morning routine takes under 5 minutes."
    ],
    amazon: [
      { name: "Wild-Caught Salmon (frozen)", url: amazonUrl("https://www.amazon.com/s?k=wild+caught+salmon+frozen"), note: "Convenient wild-caught option" },
      { name: "Organic Black Rice", url: amazonUrl("https://www.amazon.com/s?k=organic+black+forbidden+rice"), note: "Anthony's or Lotus Foods brand" },
      { name: "Sodium-Free Seasoning", url: amazonUrl("https://www.amazon.com/s?k=mrs+dash+sodium+free+seasoning"), note: "Use every day of the cleanse" },
      { name: "Sous Vide Circulator", url: amazonUrl("https://www.amazon.com/s?k=sous+vide+immersion+circulator"), note: "For the Sous Vide method" }
    ]
  },

  "morning": {
    id: "morning",
    title: "Morning Routine",
    subtitle: "Upon Rising - Every Day",
    icon: "☀️",
    time: "5-8 min",
    method: "Drinks - Before Anything Else",
    color: "#D4824A",
    why: "The ignition sequence for each day's cleansing work. Probiotics on an empty stomach reach the gut at highest potency. Citrus water stimulates stomach acid and bile production. The morning fiber drink begins sweeping the intestinal tract before any food enters.",
    slots: [
      {
        id: "citrus",
        name: "Citrus Water",
        why: "Stimulates stomach acid and bile production. Liver support and vitamin C. Both work equally well.",
        options: [
          {
            value: "Fresh Lime (half)",
            instruction: "Cut a fresh lime in half. Squeeze the juice of one half into a full glass of purified water (about 8 oz). Stir and drink within 5 minutes of your probiotic water. The sour taste is intentional and beneficial - do not add anything to sweeten it.",
            note: "Lime is slightly less tart than lemon. Identical detox benefit."
          },
          {
            value: "Fresh Lemon (half)",
            instruction: "Cut a fresh lemon in half. Squeeze the juice of one half into a full glass of purified water (about 8 oz). Stir and drink within 5 minutes of your probiotic water. Lemon has a slightly more tart profile than lime. Both are equally effective.",
            note: "Lemon is slightly more tart than lime. Identical detox benefit."
          }
        ]
      }
    ],
    steps: [
      { title: "Probiotics First - Before Anything Else", text: "Before food, before coffee, before your phone - drink a full 8 oz glass of purified water with your probiotics. Follow the dosage on your bottle. Probiotics on a completely empty stomach reach the gut at their highest potency." },
      { title: "Citrus Water", text: "Prepare your selected citrus water (see above). Drink within 5 minutes of your probiotic water. This stimulates stomach acid and bile production for the day ahead." },
      { title: "Morning Fiber Drink", text: "Add 8 oz room temperature purified water to your shaker bottle. Add 1 Tbsp ground flax seed. Add 1 tsp unsweetened cranberry concentrate. Seal and shake vigorously 10 seconds. Drink promptly - flax thickens within 1-2 minutes. NOTE: cranberry concentrate is used in the MORNING drink only - omit from the evening version." },
      { title: "Exercise Note", text: "If exercising this week, keep it gentle. Light walking, yoga, or stretching are ideal. Avoid intense cardio or strength training the first 3 to 4 days. You may feel weaker than usual - this is completely normal and temporary." }
    ],
    tips: [
      "Set out supplements, shaker bottle, and probiotic the night before - morning routine should take under 5 minutes.",
      "By 12-1 PM you should have consumed at least half your daily water goal (about 1/2 gallon).",
      "Cranberry concentrate MUST be unsweetened - sweetened cranberry juice is not a substitute."
    ],
    amazon: [
      { name: "High-Potency Probiotics (refrigerated)", url: amazonUrl("https://www.amazon.com/s?k=refrigerated+probiotics+high+potency"), note: "Higher live culture count than shelf-stable" },
      { name: "Unsweetened Cranberry Concentrate", url: amazonUrl("https://www.amazon.com/s?k=unsweetened+cranberry+juice+concentrate"), note: "Must say unsweetened - check label" },
      { name: "Organic Ground Flax Seed", url: amazonUrl("https://www.amazon.com/s?k=organic+ground+flaxseed+meal"), note: "Pre-ground only - whole seeds are ineffective" },
      { name: "Shaker Bottle (16 oz+)", url: amazonUrl("https://www.amazon.com/s?k=shaker+bottle+16+oz+blender+ball"), note: "Essential for morning and evening fiber drinks" }
    ]
  },

  "breakfast": {
    id: "breakfast",
    title: "Breakfast",
    subtitle: "Choose One of 3 Recipes",
    icon: "🍓",
    time: "5-8 min + overnight soak",
    method: "Blended or Raw",
    color: "#2D6A4F",
    why: "Fruit-forward breakfast works with your digestive system, which handles fruit enzymes most efficiently in the morning. The soaked prunes and their liquid are non-negotiable - they provide gentle digestive support critical for Days 1-2.",
    slots: [
      {
        id: "recipe",
        name: "Breakfast Recipe",
        why: "Smoothie Bowl = most filling. Fruit Salad = easiest, no equipment. Green Smoothie = most detox-forward.",
        options: [
          {
            value: "Berry Prune Smoothie Bowl",
            instruction: "BERRY PRUNE SMOOTHIE BOWL: Add to blender: 1 cup frozen berries, 4-5 soaked prunes plus ALL soaking liquid, 1 chopped seasonal fruit (mango, papaya, peach, or pear), and 1/4 cup purified water. Blend on high 30-45 seconds until completely smooth. Should be thick enough to eat with a spoon. Pour into a wide bowl and eat slowly.",
            note: "Most filling option. Best for days when you need sustained energy. NO BANANAS - they are constipating."
          },
          {
            value: "Tropical Fruit Salad with Prune Sauce",
            instruction: "TROPICAL FRUIT SALAD: Chop 1 medium apple (do not peel) and 1 cup of seasonal fruit (mango, papaya, peach, or nectarine) into bite-sized pieces. Squeeze fresh lemon or lime over immediately. Roughly chop 4-5 soaked prunes and add them with ALL their soaking liquid to the bowl. Stir gently - the liquid becomes a naturally sweet sauce. Eat slowly and chew thoroughly.",
            note: "No equipment needed. Most beginner-friendly. Best for days 1-3."
          },
          {
            value: "Green Citrus Smoothie",
            instruction: "GREEN CITRUS SMOOTHIE: Add to blender in this order: 1/2 cup purified water first, then 1 large handful of kale or spinach (stems removed), then 1 peeled orange or 2 tangerines, then 1 cored apple, then 3-4 soaked prunes plus their liquid. Blend on HIGH for 45-60 seconds until uniformly green with no visible leaf pieces. Drink immediately - green smoothies oxidize quickly.",
            note: "Most detox-forward. Best when brain fog or headache is present. Palate adjusts by day 3."
          }
        ]
      },
      {
        id: "berry",
        name: "Berry Type (Smoothie Bowl)",
        why: "All provide antioxidants and natural sweetness. Use this swap for the Smoothie Bowl recipe only.",
        options: [
          { value: "Frozen Raspberries", instruction: "Use 1 cup frozen raspberries. Deepest red color, most intensely flavored. Highest fiber of the berry options.", note: "Best for days 4-7 when palate has adjusted." },
          { value: "Frozen Strawberries", instruction: "Use 1 cup frozen strawberries (halved if large). Mildest and sweetest option - best for days 1-2 if new to cleansing.", note: "Best beginner option for days 1-3." },
          { value: "Frozen Blueberries", instruction: "Use 1 cup frozen blueberries. Highest antioxidant content. Creates a deep purple-blue bowl - most visually striking.", note: "Rinse blender immediately after - the color stains." },
          { value: "Fresh Berries in Season", instruction: "Use 1 cup fresh berries. Highest enzyme activity. May be thinner than frozen - add 3-4 ice cubes to thicken if needed.", note: "Best nutritional choice when in season." }
        ]
      }
    ],
    steps: [
      { title: "Night Before - Soak Prunes", text: "Place 4-5 dried prunes in a glass. Cover with 1/2 cup purified water. Leave overnight. By morning the liquid will be sweet, dark, and slightly syrupy. Use both the prunes AND their liquid - do not discard a single drop." },
      { title: "Morning - Prepare Your Chosen Recipe", text: "Choose your breakfast recipe above and follow the instructions. If making the Smoothie Bowl, also select your Berry Type for the specific blending instructions." },
      { title: "Eat Slowly", text: "Regardless of which breakfast you choose, eat slowly and chew thoroughly. Digestion begins in the mouth. Take at least 10 minutes for breakfast." }
    ],
    tips: [
      "NO BANANAS at any point during the cleanse - they are constipating and work against the program.",
      "Not sweet enough? Add one more prune. NEVER add sugar, honey, or any sweetener.",
      "Blender struggling with frozen fruit? Let berries sit at room temperature for 5 minutes first.",
      "Green smoothie tasting too bitter? Add one more piece of sweet fruit and blend 10 more seconds."
    ],
    amazon: [
      { name: "Ninja Professional Blender", url: amazonUrl("https://www.amazon.com/s?k=ninja+professional+blender"), note: "Best value for daily smoothie use" },
      { name: "Organic Frozen Mixed Berries", url: amazonUrl("https://www.amazon.com/s?k=organic+frozen+mixed+berries"), note: "Buy bulk bags - you use these daily" },
      { name: "Organic Dried Prunes (1 lb)", url: amazonUrl("https://www.amazon.com/s?k=organic+dried+prunes"), note: "1 lb bag is enough for the full week" }
    ]
  },

  "juice": {
    id: "juice",
    title: "Mid-Morning Juice",
    subtitle: "Choose One of 3 Recipes",
    icon: "🥤",
    time: "8 min",
    method: "Fresh Pressed - Juicer Required",
    color: "#1B4332",
    why: "Fresh juice delivers a concentrated dose of live enzymes, vitamins, and diuretic compounds that bottled juice cannot replicate. Bottled juice is pasteurized, which destroys the live enzymes that make fresh juice therapeutically different. By noon you should have consumed at least half your daily water goal.",
    slots: [
      {
        id: "recipe",
        name: "Juice Recipe",
        why: "Apple Carrot = most approachable. Green Detox = most powerful diuretic. Citrus Beet = most liver-active.",
        options: [
          {
            value: "Apple Carrot Ginger",
            instruction: "APPLE CARROT GINGER: Wash 3 medium apples and 4 large carrots. Core apples and cut into wedges (do not peel). Scrub carrots and trim tops (do not peel). Peel 1 inch of fresh ginger and peel 1/2 lemon. Juice in this order: carrots first, then apple, then ginger, then lemon last. Stir well and drink immediately.",
            note: "Best for days 1-3 when adjusting to juicing. Most approachable flavor."
          },
          {
            value: "Green Detox Juice",
            instruction: "GREEN DETOX: Wash 4 celery stalks (with leaves), 1 medium cucumber, a large handful of parsley, 2 medium apples, and 1 whole lemon (peeled). Roll parsley loosely and wrap with an apple wedge before juicing for better extraction. Juice in this order: celery first, then cucumber, then parsley-wrapped-in-apple, then remaining apple, then lemon last. Drink IMMEDIATELY - green juices oxidize fastest.",
            note: "Best for reducing bloating. Choose this on days 1-2 for maximum water retention reduction."
          },
          {
            value: "Citrus Beet Juice",
            instruction: "CITRUS BEET: Scrub 2 medium beets (do not peel) and cut into wedges. CAUTION: beet stains everything - protect your surface and wash hands immediately. Also prep: 2 medium apples (wedged), 2 medium carrots (trimmed), 1 large orange (peeled), 1/2 inch fresh ginger (peeled), 1/2 lemon (peeled). Juice in this order: carrot first, then beet, then apple, then ginger, then orange, then lemon last. NOTE: beet juice may temporarily turn urine pink/red - completely normal.",
            note: "Best for liver support. Choose this on days 3-7 when palate has adjusted."
          }
        ]
      }
    ],
    steps: [
      { title: "Wash and Prep All Produce", text: "Wash all produce thoroughly. For Green Detox Juice, wash parsley especially carefully as it carries grit between its leaves. For Citrus Beet Juice, protect your cutting surface before handling beets." },
      { title: "Juice in the Correct Order", text: "Follow the recipe order exactly. Denser produce goes first to build juice flow. Citrus always goes last to clean remaining juice through the machine and brighten the cup." },
      { title: "Stir, Taste, and Drink", text: "Stir the finished juice - layers settle quickly. Adjust with more apple if too strong, more citrus if too flat. Drink immediately. Clean your juicer right away while pulp is still wet." }
    ],
    tips: [
      "Save your juice pulp - mix it into the evening vegetable broth for extra nutrients.",
      "Feeling most bloated on days 1-2? Choose the Green Detox Juice - works fastest for reducing water retention.",
      "New to green juice? Start with 1 celery stalk and 1 extra apple, then build to the full recipe by day 3.",
      "A masticating juicer extracts more nutrients with less oxidation than a centrifugal juicer."
    ],
    amazon: [
      { name: "Omega Masticating Juicer", url: amazonUrl("https://www.amazon.com/s?k=omega+masticating+cold+press+juicer"), note: "Best nutrient retention - highly recommended" },
      { name: "Breville Centrifugal Juicer", url: amazonUrl("https://www.amazon.com/s?k=breville+juice+fountain+centrifugal"), note: "Faster and easier to clean - good beginner option" },
      { name: "Organic Carrots (5 lb bag)", url: amazonUrl("https://www.amazon.com/s?k=organic+carrots+5+lb"), note: "You will use the entire bag this week" },
      { name: "Organic Fresh Beets", url: amazonUrl("https://www.amazon.com/s?k=organic+beets+fresh"), note: "Fresh whole beets - not canned or pickled" }
    ]
  },

  "lunch": {
    id: "lunch",
    title: "Lunch",
    subtitle: "Choose One of 3 Salad Recipes",
    icon: "🥗",
    time: "10-15 min",
    method: "Raw or Steamed over Raw",
    color: "#3D6B8C",
    why: "Lunch is your largest meal and primary daily dose of dark leafy greens. Eat as much of the green base as you want - the greens are doing the toxin-binding work central to the whole program. Take Digestive Enzymes with or immediately after this meal.",
    slots: [
      {
        id: "recipe",
        name: "Salad Recipe",
        why: "Classic = most versatile. Warm Steamed = best for cold days. Chopped Beet = most intensely detox-forward for days 4-7.",
        options: [
          {
            value: "Classic Detox Salad",
            instruction: "CLASSIC DETOX SALAD: Build a large base of 3-4 handfuls mixed lettuce plus 1 handful kale or spinach. Add: grated carrots, sliced red onion, cucumber, sprouts, chopped beets, and a small handful of fresh parsley. DRESSING: 1 Tbsp extra virgin olive oil plus fresh lemon juice or 1.5 tsp raw unfiltered apple cider vinegar. Toss thoroughly. Take Digestive Enzymes as directed. Eat slowly and chew every bite.",
            note: "Best everyday salad for all 7 days. Most meal-prep friendly."
          },
          {
            value: "Warm Steamed Veggie Salad",
            instruction: "WARM STEAMED VEGGIE SALAD: Steam your starchy vegetable (squash or beets, 3/4-inch cubes) first - 8-10 minutes total. After 4 minutes, add your cruciferous vegetable (broccoli or cauliflower florets). After 3 more minutes, add your dark leafy green on top (2-3 minutes only). DRESSING: while steaming, combine 1 Tbsp olive oil, lemon juice, 1-2 minced garlic cloves, cayenne, and sodium-free seasoning in a wide bowl. Transfer hot steamed vegetables on top of a raw green base. Dress immediately.",
            note: "Best for cold days or when body craves warmth. Most satisfying comfort option."
          },
          {
            value: "Chopped Beet and Sprout Salad",
            instruction: "CHOPPED BEET AND SPROUT SALAD: Grate 1/2 medium raw beet into a separate small bowl (protect surface from staining). Place your chosen greens in salad bowl, squeeze lemon juice over them, and massage firmly for 60-90 seconds until they soften. Add 2 large handfuls sprouts, a large handful chopped parsley, 2 celery stalks sliced, 1/2 cucumber diced, 1/4 red onion sliced, and 1/2 apple sliced. Add grated beet last. DRESSING: 1 Tbsp olive oil plus 1.5 tsp raw ACV plus lemon juice plus minced garlic plus cayenne.",
            note: "Best for days 4-7 when palate has adjusted. Most intensely liver-active lunch."
          }
        ]
      },
      {
        id: "green",
        name: "Dark Leafy Green",
        why: "Primary toxin-binding green for lunch. More greens = more effective cleansing.",
        options: [
          { value: "Kale", instruction: "Remove stems completely, tear into bite-sized pieces. For raw salads, massage with a few drops of lemon juice for 60 seconds to tenderize. Most potent toxin-binding green.", note: "Massage it - 60 seconds makes a dramatic difference in texture and bitterness." },
          { value: "Spinach", instruction: "Use full leaves, no prep needed. Most tender and beginner-friendly. Best for days 1-3 when adjusting to large quantities of raw greens.", note: "Most approachable. Start here days 1-3, work toward kale by mid-week." },
          { value: "Collard Ribbons", instruction: "Remove stems completely, cut into thin 1/4-inch ribbons. MUST be massaged with lemon for 90 seconds - collards are too tough raw without massaging. Very high fiber.", note: "Cut thin and massage thoroughly. Very high fiber - most effective for toxin binding." },
          { value: "Chard", instruction: "Remove thick colored stems, tear leaves. No massage required - naturally tender. Mild, slightly sweet flavor.", note: "Most mild and versatile. Good everyday option for all 7 days." }
        ]
      },
      {
        id: "dressing",
        name: "Dressing",
        why: "The fat in olive oil is required to absorb fat-soluble vitamins from greens. The acid supports liver function.",
        options: [
          { value: "Lemon and Olive Oil", instruction: "Drizzle 1 Tbsp extra virgin olive oil evenly over the salad. Squeeze fresh lemon juice over everything. Toss thoroughly. Brightest and most versatile dressing option.", note: "Most versatile - pairs with all salad options." },
          { value: "Lime and Olive Oil", instruction: "Drizzle 1 Tbsp extra virgin olive oil evenly over the salad. Squeeze fresh lime juice over everything. Toss thoroughly. Slightly sweeter and more tropical than lemon.", note: "Pairs especially well with kale and beet-based salads." },
          { value: "ACV and Olive Oil", instruction: "Combine 1 Tbsp olive oil plus 1.5 tsp raw unfiltered ACV in a small bowl and stir vigorously before pouring over salad. Toss immediately - the dressing separates quickly. Adds probiotic benefit.", note: "Must be raw, unfiltered ACV with the mother visible. Filtered ACV lacks the probiotic cultures." }
        ]
      }
    ],
    steps: [
      { title: "Build Your Green Base", text: "Choose your salad recipe and dark leafy green above. Add 3-4 large handfuls of mixed lettuce plus your selected dark leafy green to a large bowl. Massage with lemon if using kale or collards." },
      { title: "Add Toppings and Dress", text: "Add your chosen toppings based on the salad recipe. Apply your selected dressing and toss thoroughly so every leaf is lightly coated." },
      { title: "Take Digestive Enzymes and Eat", text: "Take Digestive Enzymes as directed - chew 3-9 tabs with or immediately after this meal. Eat slowly and chew every bite. Still hungry? Add more lettuce greens - they are unlimited." }
    ],
    tips: [
      "The olive oil is NOT optional - fat-soluble vitamins A, D, E, and K from greens cannot be absorbed without dietary fat.",
      "Eat as much lettuce as you like - greens are unlimited. Add more if still hungry after the salad.",
      "This salad travels well - pack in a glass container with dressing in a separate small jar.",
      "Broccoli sprouts are the best upgrade for regular sprouts - highest sulforaphane content of any food."
    ],
    amazon: [
      { name: "Digestive Enzymes (Papaya/Pineapple)", url: amazonUrl("https://www.amazon.com/s?k=digestive+enzymes+papaya+pineapple+chewable"), note: "Take with every lunch" },
      { name: "Bragg's Raw ACV (with the mother)", url: amazonUrl("https://www.amazon.com/s?k=braggs+raw+apple+cider+vinegar"), note: "Unfiltered - do not buy filtered ACV" },
      { name: "Dulse Flakes", url: amazonUrl("https://www.amazon.com/s?k=dulse+flakes+organic"), note: "Best sodium-free mineral seasoning for salads" }
    ]
  },

  "snack": {
    id: "snack",
    title: "Afternoon Snack",
    subtitle: "Choose One of 2 Options",
    icon: "🍎",
    time: "3-10 min",
    method: "Raw or Raw + Fresh Pressed",
    color: "#B05020",
    why: "The 2-4 PM window is the most vulnerable point of any cleanse. Almonds provide the only significant protein and fat outside breakfast - this stabilizes blood sugar and ends cravings at the biochemical level. Drink 16 oz water FIRST before any food. Cravings are often thirst in disguise.",
    slots: [
      {
        id: "option",
        name: "Snack Option",
        why: "Celery and Almonds = most satisfying, no juicer needed. Apple with Juice = lighter option when hunger is less intense.",
        options: [
          {
            value: "Celery and Almonds with Herbal Tea",
            instruction: "CELERY AND ALMONDS WITH HERBAL TEA: Drink your full 16 oz of water FIRST before eating anything. Then wash 3-4 celery stalks (include the leaves - they are more nutritious than the stalks). Cut into 3-4 inch pieces. Arrange on a plate alongside your soaked almonds (20 to 25 almonds). Brew your detox tea: steep 1-2 bags for 3-5 minutes covered. No sweetener. Eat the celery and almonds slowly while sipping tea. Take 10-15 minutes for this snack.",
            note: "Best option for days when hunger is intense. No juicer needed."
          },
          {
            value: "Apple Slices with Green Juice",
            instruction: "APPLE SLICES WITH GREEN JUICE: Drink your full 16 oz of water FIRST. Then wash 1 large apple and slice into thin wedges (do not peel). Squeeze lemon over slices immediately to prevent browning. For the juice: wash 3 celery stalks, 1/2 cucumber, a small handful of parsley or mint, and 1/2 lemon (peeled). Juice in order: celery, cucumber, herb-wrapped-in-celery, lemon last. Aim for 10-12 oz. SEQUENCE: water first, then juice, then eat apple slices.",
            note: "Best lighter option. Good for days 4-7 when appetite naturally decreases."
          }
        ]
      },
      {
        id: "veggie",
        name: "Crunchy Vegetable",
        why: "All provide diuretic effect and fill the stomach with minimal caloric load.",
        options: [
          { value: "Celery Stalks", instruction: "Wash 3-4 celery stalks thoroughly. Include the leaves - they contain more nutrients than the stalks. Cut into 3-4 inch pieces or leave whole.", note: "Default best choice - most powerful for sodium flush and bloat reduction." },
          { value: "Cucumber Spears", instruction: "Wash 1 medium cucumber. Cut in half lengthwise then cut each half into 3-4 spears. No need to peel. More hydrating than celery but less diuretic.", note: "Most hydrating option. Good on warmer days." },
          { value: "Fennel Stalks", instruction: "Trim 3-4 fennel stalks from the bulb. Include the feathery fronds - most nutrient-dense part. Cut into 3-4 inch pieces. Anise flavor. Most powerfully diuretic of the three options.", note: "Most powerfully diuretic. Distinctive anise flavor - try on day 3 or 4." }
        ]
      }
    ],
    steps: [
      { title: "Soak Almonds the Night Before", text: "Place 20 to 25 raw almonds in a glass and cover with purified water. Leave overnight. Drain and rinse in the morning. Soaked almonds are softer, easier to digest, and more nutritious because soaking neutralizes phytic acid which blocks mineral absorption." },
      { title: "Drink 16 oz Water First", text: "Before eating your snack, drink your full 16 oz of purified water. Water first expands the stomach slightly so the small amount of food that follows registers as more filling." },
      { title: "Prepare and Eat Slowly", text: "Follow your chosen snack option instructions above. Eat slowly and deliberately over 10-15 minutes. Chew each almond at least 20 times. The slower you eat, the more satisfied you will feel." }
    ],
    tips: [
      "Still hungry after the snack? More crunchy vegetable is unlimited. Try water and herbal tea before reaching for extra almonds.",
      "20 to 25 almonds is the right amount - enough to stabilize blood sugar without overloading fat intake.",
      "Save celery leaves for the evening vegetable broth - adds flavor and nutrients, nothing wasted.",
      "Juicer feels like too much effort in the afternoon? Replace juice with herbal tea and an extra celery stalk."
    ],
    amazon: [
      { name: "Raw Organic Almonds (1 lb)", url: amazonUrl("https://www.amazon.com/s?k=raw+organic+almonds+unsalted+1+lb"), note: "Enough for the full 7 days of snacks" },
      { name: "Detox Herbal Tea (dandelion/burdock)", url: amazonUrl("https://www.amazon.com/s?k=detox+herbal+tea+dandelion+burdock"), note: "Look for these herbs on the label" }
    ]
  },

  "dinner": {
    id: "dinner",
    title: "Dinner",
    subtitle: "Choose One of 3 Recipes",
    icon: "🌿",
    time: "15-20 min",
    method: "Steamed, Sauteed, or Raw",
    color: "#2D6A4F",
    why: "Dinner completes the day's toxin-binding cycle. The dark leafy green grabs toxins mobilized throughout the day and carries them out overnight. The starchy vegetable provides complex carbs that sustain blood sugar through the night and prevent the late hunger that breaks cleanses. Not hungry? Warm vegetable broth is a fully acceptable substitute.",
    slots: [
      {
        id: "recipe",
        name: "Dinner Recipe",
        why: "Steamed = default comfort bowl. Sauteed = most flavorful, converts skeptics. Raw = lightest, best for days 5-7.",
        options: [
          {
            value: "Steamed Kale and Butternut Squash Bowl",
            instruction: "STEAMED KALE AND BUTTERNUT SQUASH BOWL: Peel and cube 1.5 cups butternut squash into 3/4-inch pieces. Cut your cruciferous vegetable into medium florets. Remove stems from your dark leafy green. Mince 2 garlic cloves and let rest 5 minutes. STEAM: 1.5 inches purified water, rolling boil. Add squash first (8-10 min total). After 4 min, add cruciferous. After 3 more min, add greens on top (2-3 min only). DRESSING: while steaming, combine 1 Tbsp olive oil, lemon juice, minced garlic, cayenne, and sodium-free seasoning in serving bowl. Add hot vegetables, toss immediately. Rest 2 minutes before eating.",
            note: "Default dinner. Best for all 7 days. Batch-prep squash at week start."
          },
          {
            value: "Sauteed Collards and Broccoli with Garlic",
            instruction: "SAUTEED COLLARDS AND BROCCOLI WITH GARLIC: Remove your green stems, cut into 1/2-inch ribbons or pieces. Slice 3 garlic cloves into thin rounds. HEAT: wide skillet over medium heat 90 seconds before adding oil. Add 1 Tbsp olive oil, let shimmer. Add sliced garlic - stir constantly, golden in 60-90 seconds. Add cruciferous, toss to coat, single layer, 90 seconds undisturbed then toss. Add greens in batches plus 1-2 Tbsp water. Toss every 30-45 seconds. Remove from heat. Squeeze lemon over everything IMMEDIATELY off heat. Eat right away.",
            note: "Most flavorful dinner. Best for days 2-3 when monotony hits hardest. The dinner that converts skeptics."
          },
          {
            value: "Raw Detox Plate",
            instruction: "RAW DETOX PLATE: MAKE THE DIPPING SAUCE FIRST: combine 1 Tbsp olive oil, juice of 1/2 lemon or lime, 1 small clove very finely minced garlic, small pinch cayenne, 1/2 tsp raw ACV, and a sprinkle of dulse or kelp powder. Whisk vigorously. PLATE: slice 1 cucumber into rounds, cut 2 carrots into sticks, cut 3-4 celery stalks into sticks, grate 1/2 beet into a separate bowl then scatter over plate, add 1 handful sprouts and a handful of parsley, fan 1/2 apple thinly sliced along one edge. ARRANGE each vegetable in its own section. Presentation matters for this recipe - it elevates the eating experience.",
            note: "Lightest dinner. Best for days 5-7 when appetite naturally decreases. The dipping sauce is essential."
          }
        ]
      },
      {
        id: "green",
        name: "Dark Leafy Green",
        why: "Essential for completing the day's toxin-binding cycle. Double it on days 5-7.",
        options: [
          { value: "Kale", instruction: "Remove stems completely. Tear into large pieces for steaming or large pieces for sauteing. Most potent toxin-binding green for dinner.", note: "Most potent. Best everyday choice for all 7 days." },
          { value: "Collard Greens", instruction: "Remove stems. For steaming: tear into pieces. For sauteing: cut into 1/2-inch ribbons. Thin cut is essential for even cooking. Most fiber-dense option.", note: "Most fiber-dense. Best for sauteed preparation. Cut thin for best results." },
          { value: "Chard", instruction: "Remove thick colored stems. Tear into large pieces. Wilts very quickly when sauteing - add only in the last 2 minutes. Most mild flavor.", note: "Most mild. Good option when kale taste has become too familiar." },
          { value: "Beet Greens", instruction: "Remove any thick stems. Tear into pieces. Wilts almost instantly when sauteing - add only in the last 90 seconds. Very mild and earthy.", note: "Use when beets came with greens attached to avoid waste. Add at the very end of cooking." }
        ]
      },
      {
        id: "starch",
        name: "Starchy Vegetable",
        why: "Provides complex carbs for overnight satiety. Prevents the 10 PM hunger that breaks cleanses.",
        options: [
          { value: "Butternut Squash", instruction: "Peel and cube into 3/4-inch pieces. Uniform size is critical for even cooking. Easiest to prep. Mildly sweet. Batch-prep at week start - keeps 5-6 days refrigerated.", note: "Easiest to prep. Best everyday choice for most dinners." },
          { value: "Kabocha Squash", instruction: "Peel and cube into 3/4-inch pieces. Harder skin than butternut - use a heavy knife carefully. Nuttier and denser flavor. May need 1-2 extra steam minutes.", note: "Richer flavor than butternut. May need extra steam time." },
          { value: "Beets (cubed)", instruction: "Scrub and cube into 3/4-inch pieces (do not peel). STAINS everything - protect surface and wash hands immediately. Start steaming 4-5 minutes before squash would go in (12-15 min total). Turns the bowl magenta.", note: "Most liver-active starchy option. Stains heavily. Best for days 3-7." }
        ]
      }
    ],
    steps: [
      { title: "Prep All Vegetables", text: "Choose your dinner recipe and vegetable swaps above. Do your prep: cube starchy vegetables, remove greens stems, slice garlic and let rest 5 minutes before cooking." },
      { title: "Cook Using Your Chosen Method", text: "Follow the recipe instructions above exactly. For steamed dishes, never steam past slight fork resistance. For sauteed dishes, never overcrowd the pan - cook in batches if needed." },
      { title: "Dress and Serve", text: "Apply dressing while vegetables are still hot so it absorbs into the food. The acid (lemon or lime) must always be applied OFF HEAT to preserve vitamin C. Rest 2 minutes then eat slowly." }
    ],
    tips: [
      "Days 5-7: double the dark leafy green at dinner. Night is when the body does its most active elimination work.",
      "Batch-prep butternut squash at week start - cube the entire squash, store in glass container, use across multiple dinners.",
      "The steaming water left in the pot is nutritious broth - season lightly and drink warm after dinner.",
      "Want more substance? Steam 1/2 cup extra squash separately and add to the sauteed recipe for the final 2 minutes."
    ],
    amazon: [
      { name: "Tiered Electric Steamer", url: amazonUrl("https://www.amazon.com/s?k=tiered+electric+vegetable+steamer"), note: "Cook squash and greens at different stages" },
      { name: "Stainless Steel Skillet (12-inch)", url: amazonUrl("https://www.amazon.com/s?k=stainless+steel+skillet+12+inch"), note: "Wide pan essential - prevents overcrowding" },
      { name: "Glass Food Storage Containers", url: amazonUrl("https://www.amazon.com/s?k=glass+food+storage+containers+airtight"), note: "For batch-prepped squash and meal prep" }
    ]
  },

  "evening": {
    id: "evening",
    title: "Evening Routine",
    subtitle: "Do NOT Skip This",
    icon: "🌛",
    time: "5 min active + 10-15 min tea",
    method: "Drinks",
    color: "#1B4332",
    why: "Everything today mobilized toxins from fat cells, liver, lymphatic system, and gut wall into the digestive tract for elimination. This drink carries those toxins OUT of the body overnight. Without it, mobilized toxins can be reabsorbed through the intestinal wall. This is the closing mechanism of the entire day's cleansing work. It is not optional.",
    slots: [
      {
        id: "tea",
        name: "Evening Tea",
        why: "Supports liver cell regeneration during the overnight fasting window. The liver does its most active repair work from 11 PM to 3 AM.",
        options: [
          {
            value: "Detoxifying Herbal Tea",
            instruction: "DETOXIFYING HERBAL TEA: Bring purified water to near boil. Remove from heat and wait 60 seconds. Add 1-2 detox herbal tea bags. Steep 5-7 minutes COVERED - roots and barks need extended steeping to release active compounds. Remove bags WITHOUT squeezing. Sit somewhere comfortable. No screens if possible. Drink slowly over 10-15 minutes. This is your signal that the day's cleansing work is done.",
            note: "Best everyday option. Look for dandelion root, burdock, or milk thistle on the label."
          },
          {
            value: "Chamomile Tea",
            instruction: "CHAMOMILE TEA: Bring purified water to near boil. Remove from heat, wait 60 seconds. Steep 1-2 chamomile bags for 4-5 minutes. Chamomile has fewer active detox compounds than a dedicated detox blend but is excellent for nervous system relaxation and sleep quality - and deep sleep is when the body does its most active repair work. Best choice on high-stress days.",
            note: "Best on high-stress days. Less active detox but excellent for sleep quality."
          },
          {
            value: "Dandelion Root Tea",
            instruction: "DANDELION ROOT TEA: Bring purified water to near boil. Remove from heat, wait 60 seconds. Steep 1-2 dandelion root bags for 7-10 minutes - dandelion root requires longer steeping than leaf teas to release its active compounds. Dandelion root is one of the most liver-supportive herbs available. Mildly bitter flavor. Do not add sweetener.",
            note: "Most targeted liver support. Steep longer than most teas."
          },
          {
            value: "Senna Tea (Evening Only - Use Carefully)",
            instruction: "SENNA TEA - READ CAREFULLY: Senna is a stimulant laxative, significantly stronger than herbal detox tea. RULES: (1) Evening ONLY - never morning or afternoon. (2) NEVER two consecutive nights. (3) Best reserved for day 2 or 3 ONLY if elimination has been notably slow. (4) Not recommended for anyone with digestive sensitivities or on medications without consulting a doctor first. Steep 1 bag for 3 minutes ONLY. Expect results 6-12 hours later.",
            note: "USE SPARINGLY. Evening only. Never two consecutive nights. Read all cautions."
          }
        ]
      }
    ],
    steps: [
      { title: "Time This Correctly - Read Before Starting", text: "The evening fiber drink must be consumed at least 90 minutes after dinner and at least 30 minutes before bed. Ideal timing: approximately 8-9 PM for people who sleep around 10:30-11 PM." },
      { title: "Prepare and DRINK FAST", text: "STEP A: Add 8-10 oz ROOM TEMPERATURE purified water to shaker bottle first. STEP B: Add 1 Tbsp ground flax seed. Add 1 Tbsp psyllium husk. Do NOT add cranberry - morning only. STEP C: Seal immediately. STEP D: Shake vigorously 10-15 seconds. STEP E - CRITICAL: Open and drink the ENTIRE contents IMMEDIATELY and CONTINUOUSLY. Do NOT sip slowly. Psyllium husk begins gelling within 60-90 seconds. The ENTIRE drink must be consumed within 30-45 seconds of opening." },
      { title: "Follow Immediately with 8 oz Water", text: "Without pausing, drink an additional 8 oz of purified water immediately after the fiber drink. This second glass is NOT optional. Psyllium husk requires significant water - insufficient water causes the fiber to swell in the wrong place." },
      { title: "Brew and Drink Your Evening Tea", text: "See your selected tea instructions above. Sit somewhere comfortable. Drink slowly over 10-15 minutes. No screens if possible. This is the signal to your body that the day's work is done." }
    ],
    tips: [
      "MOST IMPORTANT: Drink the fiber drink FAST - all at once - then chase IMMEDIATELY with 8 oz water. Do not sip slowly.",
      "New to psyllium? Reduce to 1/2 Tbsp for days 1-3, build to the full tablespoon by day 4.",
      "The morning after this drink: expect significantly increased elimination. This is exactly what is supposed to happen.",
      "Whole flax seeds are NOT a substitute for ground flax seed - the body cannot digest whole flax. Must be pre-ground."
    ],
    amazon: [
      { name: "Organic Psyllium Husk Powder", url: amazonUrl("https://www.amazon.com/s?k=organic+psyllium+husk+powder"), note: "Most important supplement in the guide" },
      { name: "Organic Ground Flaxseed Meal", url: amazonUrl("https://www.amazon.com/s?k=organic+ground+flaxseed+meal"), note: "Pre-ground only - whole seeds are not effective" },
      { name: "Detox Herbal Tea (dandelion/burdock)", url: amazonUrl("https://www.amazon.com/s?k=detox+herbal+tea+dandelion+burdock"), note: "Look for these specific herbs on the label" },
      { name: "Senna Leaf Tea (organic)", url: amazonUrl("https://www.amazon.com/s?k=senna+leaf+tea+organic"), note: "Per strict guidelines above - evening only" }
    ]
  }

};

const MEAL_ORDER = ["morning", "breakfast", "juice", "lunch", "snack", "dinner", "evening"];
const MEAL_LABELS = {
  morning: "Morning Routine",
  breakfast: "Breakfast",
  juice: "Mid-Morning Juice",
  lunch: "Lunch",
  snack: "Afternoon Snack",
  dinner: "Dinner",
  evening: "Evening Routine"
};

const SHOP_DATA = {

  // ── BUCKET 1: ONE-TIME PURCHASES ──────────────────────────────────────────
  // Buy once, use every cleanse. Do NOT rebuy these each time.
  onetime: [

    // ── GROUPED: Pick one per category ──────────────────────────────────────
    {
      group: "blender", label: "Blender", icon: "🍳",
      required: true,
      sublabel: "Required for smoothies and green drinks",
      options: [
        { label: "Ninja Professional - Best value",        url: amazonUrl("https://www.amazon.com/s?k=ninja+professional+blender"),          note: "Best value for daily smoothie use. Buy once, lasts years." },
        { label: "Vitamix - Premium, lifetime quality",    url: amazonUrl("https://www.amazon.com/s?k=vitamix+blender"),                     note: "Lifetime investment. The last blender you will ever buy." },
      ]
    },
    {
      group: "juicer", label: "Juicer", icon: "🥤",
      required: true,
      sublabel: "Required for mid-morning and afternoon juices",
      options: [
        { label: "Omega Masticating - Best nutrient retention",  url: amazonUrl("https://www.amazon.com/s?k=omega+masticating+cold+press+juicer"),   note: "Best nutrient retention. Highly recommended over centrifugal." },
        { label: "Breville Centrifugal - Faster, easier to clean", url: amazonUrl("https://www.amazon.com/s?k=breville+juice+fountain+centrifugal"), note: "Faster and easier to clean. Good beginner option." },
      ]
    },
    {
      group: "steamer", label: "Steamer", icon: "♨️",
      required: true,
      sublabel: "Required for dinner vegetable preparation",
      options: [
        { label: "Tiered Electric Steamer - Multi-stage cooking", url: amazonUrl("https://www.amazon.com/s?k=tiered+electric+vegetable+steamer"),    note: "Cook squash, broccoli, and greens at different stages simultaneously." },
        { label: "Stainless Basket - Simple, stovetop",          url: amazonUrl("https://www.amazon.com/s?k=steamer+basket+stainless+steel"),        note: "Fits inside any pot. Simple, inexpensive, and effective." },
        { label: "Bamboo Steamer - Traditional, no electricity", url: amazonUrl("https://www.amazon.com/s?k=bamboo+steamer+basket+2+tier+10+inch"),  note: "Traditional steaming. No electricity needed. 2-tier 10-inch." },
      ]
    },
    {
      group: "cooler", label: "Portable Cooler", icon: "🧊",
      required: false,
      sublabel: "Optional - for taking meals away from home",
      options: [
        { label: "Lunch Cooler - Half-day outings",        url: amazonUrl("https://www.amazon.com/s?k=insulated+lunch+cooler+bag"),           note: "Keeps salads, juices, and snacks fresh. Best for half-day outings." },
        { label: "Large Soft-Sided - Full-day outings",    url: amazonUrl("https://www.amazon.com/s?k=large+soft+sided+cooler+insulated"),    note: "Fits a full day of meals with ice packs. Best for full-day outings." },
        { label: "Electric DC/Wall - Frequent travelers",  url: amazonUrl("https://www.amazon.com/s?k=electric+portable+cooler+dc+car"),      note: "Operates on car or wall power. Best for frequent travelers." },
      ]
    },

    // ── SINGLE ITEMS: No choice needed ──────────────────────────────────────
    { name: "Smart Body Scale",                         url: amazonUrl("https://www.amazon.com/s?k=smart+body+scale+bmi+body+fat"),            note: "Tracks weight, BMI, body fat %, muscle %, water %, bone %.",              priority: true  },
    { name: "Shaker Bottle (16 oz+ with blender ball)", url: amazonUrl("https://www.amazon.com/s?k=shaker+bottle+16+oz+blender+ball"),         note: "Essential for fiber drinks. The blender ball prevents clumping.",          priority: true  },
    { name: "Glass Water Bottle (32 oz+)",              url: amazonUrl("https://www.amazon.com/s?k=glass+water+bottle+32+oz"),                  note: "For tracking daily water intake. Fill it twice to hit your gallon goal.",   priority: true  },
    { name: "Glass Food Storage Containers (Pyrex)",    url: amazonUrl("https://www.amazon.com/s?k=pyrex+glass+food+storage+containers"),       note: "For meal prep, soaking almonds and prunes, storing batch-prepped squash.", priority: true  },
    { name: "Stainless Steel Skillet (12-inch)",        url: amazonUrl("https://www.amazon.com/s?k=stainless+steel+skillet+12+inch"),           note: "Wide pan essential for sauteed dinner recipes.",                           priority: false },
    { name: "Box Grater (stainless steel)",             url: amazonUrl("https://www.amazon.com/s?k=box+grater+stainless+steel"),                note: "For grating raw beets and carrots. You use this every cleanse.",           priority: false },
    { name: "Portable Kitchen Scale (digital)",         url: amazonUrl("https://www.amazon.com/s?k=digital+kitchen+scale+food+grams"),          note: "For precise ingredient portions. Compact enough to pack for travel.",       priority: false },
    { name: "Portable Mini Photo Printer",              url: amazonUrl("https://www.amazon.com/s?k=portable+mini+photo+printer+bluetooth"),     note: "Canon Ivy, HP Sprocket, or Polaroid Hi-Print. Prints progress photos.",    priority: false },
  ],

  // ── BUCKET 2: PER-CLEANSE PURCHASES ───────────────────────────────────────
  // Buy fresh each time. ~$80-120 per cleanse. Shop twice: Day 1 and Day 4.
  percleanse: [
    { name: "Wild-Caught Salmon (1-2 lbs)",             url: amazonUrl("https://www.amazon.com/s?k=wild+caught+salmon+frozen"),             note: "Pre-cleanse meal only. Wild-caught preferred over farmed.",                 priority: true  },
    { name: "Fresh Asparagus (1 bunch)",                url: amazonUrl("https://www.amazon.com/s?k=fresh+asparagus"),                      note: "Pre-cleanse meal. Natural diuretic that starts the cleansing process.",     priority: true  },
    { name: "Organic Black Rice",                       url: amazonUrl("https://www.amazon.com/s?k=organic+black+forbidden+rice"),         note: "Pre-cleanse meal only. Also called forbidden rice.",                        priority: true  },
    { name: "Organic Apples (12-24 count bag)",         url: amazonUrl("https://www.amazon.com/s?k=organic+apples+bag"),                  note: "Used daily in juices, smoothies, salads, and snacks. Buy in bulk.",         priority: true  },
    { name: "Organic Kale (2-3 large bunches)",         url: amazonUrl("https://www.amazon.com/s?k=organic+kale+fresh"),                  note: "Most important green in the program. Restock around Day 4.",               priority: true  },
    { name: "Organic Spinach (large bag)",              url: amazonUrl("https://www.amazon.com/s?k=organic+spinach+bag"),                 note: "Best beginner green for smoothies and salads.",                             priority: true  },
    { name: "Organic Celery (2-3 bunches)",             url: amazonUrl("https://www.amazon.com/s?k=organic+celery"),                      note: "Used daily in juices, snacks, and dinner. Restock at Day 4.",               priority: true  },
    { name: "Organic Carrots (5 lb bag)",               url: amazonUrl("https://www.amazon.com/s?k=organic+carrots+5+lb"),               note: "Used daily in juices and salads. Buy the large bag.",                       priority: true  },
    { name: "Organic Beets (4-6 medium, fresh whole)",  url: amazonUrl("https://www.amazon.com/s?k=organic+beets+fresh"),                note: "Fresh whole beets only, not canned or pickled.",                            priority: true  },
    { name: "Organic Lemons (bag of 6-8)",              url: amazonUrl("https://www.amazon.com/s?k=organic+lemons+bag"),                 note: "Used every single day. Buy a bag.",                                         priority: true  },
    { name: "Organic Limes (bag of 6-8)",               url: amazonUrl("https://www.amazon.com/s?k=organic+limes+bag"),                  note: "Used every single day. Buy a bag.",                                         priority: true  },
    { name: "Oranges or Tangerines (6-8)",              url: amazonUrl("https://www.amazon.com/s?k=organic+oranges+bag"),                note: "For green citrus smoothie and mid-morning juice.",                           priority: false },
    { name: "Organic Frozen Mixed Berries (2 lb)",      url: amazonUrl("https://www.amazon.com/s?k=organic+frozen+mixed+berries"),       note: "For breakfast smoothie bowls. Buy the bulk bag.",                           priority: true  },
    { name: "Organic Butternut Squash (1-2 medium)",    url: amazonUrl("https://www.amazon.com/s?k=organic+butternut+squash"),           note: "Primary dinner starchy vegetable. Batch-prep at week start.",               priority: true  },
    { name: "Organic Broccoli (2 heads)",               url: amazonUrl("https://www.amazon.com/s?k=organic+broccoli+fresh"),             note: "Primary cruciferous for dinner. Sulforaphane activates liver detox.",        priority: true  },
    { name: "Organic Cucumber (4-5 medium)",            url: amazonUrl("https://www.amazon.com/s?k=organic+cucumber"),                   note: "Used in juices, salads, and snacks throughout the week.",                   priority: true  },
    { name: "Organic Parsley (2 large bunches)",        url: amazonUrl("https://www.amazon.com/s?k=organic+fresh+parsley"),              note: "Used daily in juices and salads. Most detox-active herb in the program.",   priority: true  },
    { name: "Fresh Ginger Root (3-4 inch piece)",       url: amazonUrl("https://www.amazon.com/s?k=fresh+ginger+root+organic"),         note: "For mid-morning juices. Buy fresh root, not ground.",                       priority: true  },
    { name: "Garlic (1 head)",                          url: amazonUrl("https://www.amazon.com/s?k=organic+garlic+head"),               note: "For dinner recipes. Organosulfur compounds support liver detox.",            priority: false },
    { name: "Red Onion (1-2 medium)",                   url: amazonUrl("https://www.amazon.com/s?k=organic+red+onion"),                  note: "For lunch salads.",                                                         priority: false },
    { name: "Organic Sprouts (broccoli sprouts best)",  url: amazonUrl("https://www.amazon.com/s?k=organic+sprouts+broccoli"),          note: "For lunch salads. Broccoli sprouts have highest sulforaphane content.",      priority: false },
    { name: "Mixed Lettuce (large container)",          url: amazonUrl("https://www.amazon.com/s?k=organic+mixed+salad+greens"),        note: "Unlimited on the cleanse. Buy the largest container available.",             priority: true  },
    { name: "Organic Dried Prunes (1 lb bag)",          url: amazonUrl("https://www.amazon.com/s?k=organic+dried+prunes"),              note: "Soaked overnight, used in breakfast every day. 1 lb covers the full week.",  priority: true  },
    { name: "Raw Organic Almonds (1 lb bag)",           url: amazonUrl("https://www.amazon.com/s?k=raw+organic+almonds+unsalted+1+lb"), note: "Soaked overnight, used as afternoon snack. 1 lb covers all 7 days.",        priority: true  },
    { name: "Seasonal Fruit (mango, papaya, peach)",    url: amazonUrl("https://www.amazon.com/s?k=organic+mango+fresh"),              note: "For breakfast recipes. Papaya is highest in digestive enzymes.",             priority: false },
    { name: "Cayenne Pepper",                           url: amazonUrl("https://www.amazon.com/s?k=cayenne+pepper+organic+ground"),    note: "Essential spice for warm steamed lunch and dinner recipes. Available at any grocery store.", priority: true  },
    { name: "Cauliflower (1 head)",                     url: amazonUrl("https://www.amazon.com/s?k=organic+cauliflower+fresh"),        note: "Used in warm steamed lunch and cruciferous dinner options. Buy fresh each cleanse.", priority: false },
    { name: "Collard Greens or Swiss Chard (1 bunch)",  url: amazonUrl("https://www.amazon.com/s?k=organic+collard+greens+fresh"),    note: "Green swap option for lunch and dinner recipes. Either variety works — buy fresh.", priority: false },
    { name: "Vegetable Broth (32oz carton)",            url: amazonUrl("https://www.amazon.com/s?k=organic+vegetable+broth+low+sodium"), note: "Used in dinner substitute and evening drink recipes. Low sodium preferred.", priority: false },
    { name: "Fennel (1 bulb)",                          url: amazonUrl("https://www.amazon.com/s?k=fresh+fennel+bulb"),                note: "Afternoon snack veggie swap option — use stalks and fronds. Available at most grocery stores.", priority: false },
    { name: "Sea Salt and Black Pepper",                url: amazonUrl("https://www.amazon.com/s?k=sea+salt+and+black+pepper+organic"), note: "Basic seasoning for pre-cleanse meal and recipes. You likely already have these.", priority: false },
  ],

  // ── BUCKET 3: AS-NEEDED REPLENISHMENT ─────────────────────────────────────
  // Supplements and seasonings. Most last multiple cleanses.
  // Check your stock before each cleanse and reorder only what you need.
  restock: [
    { name: "Probiotics (refrigerated, high potency)", url: amazonUrl("https://www.amazon.com/s?k=refrigerated+probiotics+high+potency"),  note: "Garden of Life, Culturelle, or Renew Life. 10B+ CFU. Refrigerated.",       priority: true  },
    { name: "Psyllium Husk Powder (organic)",          url: amazonUrl("https://www.amazon.com/s?k=organic+psyllium+husk+powder"),          note: "Most important supplement. Buy the powder, not capsules. Anthony's or NOW.", priority: true  },
    { name: "Ground Flaxseed Meal (organic)",          url: amazonUrl("https://www.amazon.com/s?k=organic+ground+flaxseed+meal"),         note: "Must be pre-ground. Whole flax seeds pass through undigested.",             priority: true  },
    { name: "Digestive Enzymes (papaya or pineapple)", url: amazonUrl("https://www.amazon.com/s?k=digestive+enzymes+papaya+pineapple+chewable"), note: "Take with every lunch. American Health or Source Naturals.",           priority: true  },
    { name: "Unsweetened Cranberry Concentrate",       url: amazonUrl("https://www.amazon.com/s?k=unsweetened+cranberry+juice+concentrate"), note: "Must say UNSWEETENED. Dynamic Health or Lakewood Organic.",               priority: true  },
    { name: "Detox Herbal Tea (dandelion/burdock)",    url: amazonUrl("https://www.amazon.com/s?k=detox+herbal+tea+dandelion+burdock"),    note: "Traditional Medicinals Everyday Detox or Yogi DeTox.",                      priority: true  },
    { name: "Sodium-Free Seasoning (Mrs. Dash)",       url: amazonUrl("https://www.amazon.com/s?k=mrs+dash+sodium+free+seasoning"),        note: "Used every day of the cleanse instead of salt. Keep extra on hand.",         priority: true  },
    { name: "Raw Unfiltered Apple Cider Vinegar",      url: amazonUrl("https://www.amazon.com/s?k=braggs+raw+apple+cider+vinegar"),        note: "Must be raw, unfiltered, with the mother. Bragg's is the standard.",         priority: true  },
    { name: "Extra Virgin Olive Oil",                  url: amazonUrl("https://www.amazon.com/s?k=organic+extra+virgin+olive+oil"),        note: "Used in every dressing and dinner recipe. Buy quality.",                     priority: true  },
    { name: "Dulse Flakes or Kelp Powder",             url: amazonUrl("https://www.amazon.com/s?k=dulse+flakes+organic"),                 note: "Sodium-free mineral seasoning. Iodine and trace minerals.",                 priority: false },
    { name: "Dandelion Root Tea",                      url: amazonUrl("https://www.amazon.com/s?k=dandelion+root+tea+organic"),           note: "Most targeted liver support tea. Steep 7-10 minutes.",                      priority: false },
    { name: "Chamomile Tea",                           url: amazonUrl("https://www.amazon.com/s?k=organic+chamomile+tea"),                note: "For high-stress evenings. Best choice when sleep quality is a priority.",    priority: false },
    { name: "Senna Leaf Tea (use with caution)",       url: amazonUrl("https://www.amazon.com/s?k=senna+leaf+tea+organic"),               note: "Stimulant laxative. Evening only, never two consecutive nights.",           priority: false },
  ],

  // ── DELIVERY SERVICES ─────────────────────────────────────────────────────
  delivery: [
    { name: "Amazon Fresh",       url: "https://www.amazon.com/fmc/m/30023784",                    note: "Grocery delivery from Amazon. Free with Prime. Covers most of the list.",          icon: "📦", affiliate: true  },
    { name: "Whole Foods Delivery", url: "https://www.amazon.com/fmc/m/30023784",                  note: "Whole Foods via Amazon. Best source for organic produce and specialty items.",      icon: "🌿", affiliate: true  },
    { name: "Instacart",          url: "https://www.instacart.com",                                 note: "Delivery from local health food stores and supermarkets. Widest store selection.",  icon: "🚚", affiliate: true  },
    { name: "Sam's Club Delivery", url: "https://www.samsclub.com/online-groceries",               note: "Bulk produce and groceries at warehouse prices. Affiliate commissions on purchases.", icon: "🏬", affiliate: true  },
    { name: "Costco Delivery",    url: "https://www.costco.com/grocery.html",                       note: "Bulk organic produce and staples. Membership required. Commission on sign-ups.",    icon: "🏪", affiliate: true  },
    { name: "DoorDash Grocery",   url: "https://www.doordash.com/grocery",                         note: "Grocery delivery from local stores. Good for last-minute items.",                   icon: "🏃", affiliate: false },
    { name: "Uber Eats Grocery",  url: "https://www.ubereats.com/grocery",                         note: "Grocery delivery in most areas. Compare prices across stores.",                     icon: "🛵", affiliate: false },
  ],

};
