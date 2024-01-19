var axios = require("axios");
var path = require("path");
var fs = require("fs");
const { exit } = require("process");

const allCardsApi = "https://earthbornerangers.decksmith.app/app/cards.json";

const rangersDbApi = "https://gapi.rangersdb.com/v1/graphql";

const setsQuery = {
  operationName: "getSetNames",
  variables: {
    locale: "en",
  },
  query:
    "query getSetNames($locale: String!) {\n  sets: rangers_set_type_localized(\n    where: {locale: {_eq: $locale}}\n    order_by: {id: desc}\n  ) {\n    ...SetType\n    __typename\n  }\n}\n\nfragment SetType on rangers_set_type_localized {\n  id\n  name\n  sets {\n    id\n    name\n    __typename\n  }\n  __typename\n}",
};

const cardsQuery = {
  operationName: "getAllCards",
  variables: {
    locale: "en",
  },
  query:
    "query getAllCards($locale: String!) {\n  cards: rangers_card_localized(where: {locale: {_eq: $locale}}) {\n    ...Card\n    __typename\n  }\n  all_updated_at: rangers_card_updated(where: {locale: {_eq: $locale}}) {\n    updated_at\n    __typename\n  }\n}\n\nfragment Card on rangers_card_localized {\n  id\n  name\n  real_traits\n  traits\n  equip\n  presence\n  token_id\n  token_name\n  token_plurals\n  token_count\n  harm\n  approach_conflict\n  approach_reason\n  approach_exploration\n  approach_connection\n  text\n  set_id\n  set_name\n  set_type_id\n  set_size\n  set_type_name\n  set_position\n  quantity\n  level\n  flavor\n  type_id\n  type_name\n  cost\n  aspect_id\n  aspect_name\n  aspect_short_name\n  progress\n  imagesrc\n  position\n  deck_limit\n  spoiler\n  __typename\n}",
};

const DRY_RUN = false;

const doImport = async () => {
  const rootDir = path.join(__dirname, "..");
  const setsDir = path.join(__dirname, "..", "sets");
  const rawDir = path.join(__dirname, "..", "raw");

  if (!fs.existsSync(setsDir)) {
    throw new Error("sets directory missing");
  }

  if (!fs.existsSync(rawDir)) {
    throw new Error("raw directory missing");
  }

  console.log(`**** getting all sets ****`);
  const sets = await axios.post(rangersDbApi, setsQuery).catch((e) => {
    console.log("got an axios error" + ": " + e.message);
  });
  console.log("*********** got all sets *****");

  // append some sets that are missing
  sets.data.data.sets = sets.data.data.sets.concat([
    {
      id: "misc",
      name: "Miscellaneous",
      sets: [
        { id: "personalities", name: "Personalities" },
        { id: "lingering_injury", name: "Lingering Injury" },
        { id: "weather", name: "Weather" },
        { id: "aspects", name: "Aspects" },
        { id: "mission", name: "Mission" },
        { id: "location", name: "Location" },
        { id: "challenge", name: "Challenge" },
        { id: "reward", name: "Reward" },
      ],
    },
  ]);

  console.log(`**** getting all cards ****`);
  const allCards = await axios.get(allCardsApi).catch((e) => {
    console.log("got an axios error" + ": " + e.message);
  });
  console.log("*********** got all cards *****");

  console.log(`**** getting ranger cards ****`);
  const rangerCards = await axios.post(rangersDbApi, cardsQuery).catch((e) => {
    console.log("got an axios error" + ": " + e.message);
  });
  console.log("*********** got ranger cards *****");

  // annotate all cards with ids when available
  // First, put all of both into maps for speed
  const rangerCardMap = {};
  const allCardMap = {};

  const rangerCardArray = rangerCards.data.data.cards;

  rangerCardArray.forEach((rc) => {
    rc.name = rc.name.replace(/’/g, `'`);
    if (rangerCardMap[rc.name]) {
      console.log("WARNING - found multiple ranger cards with name " + rc.name);
    }

    rangerCardMap[rc.name] = rc;
  });

  let allCardArray = allCards.data.children;

  allCardArray.forEach((c) => {
    c.title = c.title.replace(/’/g, `'`);
    c.title = c.title.replace("Desparation", "Desperation");
    if (allCardMap[c.title]) {
      console.log("WARNING - found multiple cards with name " + c.title);
    }

    allCardMap[c.title] = c;
  });

  // allCardArray.forEach((c) => {
  //   const rc = rangerCardMap[c.title];
  //   if (rc) {
  //     c.code = rc.id;
  //   }
  // });

  // rangerCardArray.forEach((rc) => {
  //   if (!allCardMap[rc.name] || !allCardMap[rc.name].code) {
  //     console.log(
  //       "WARNING - Didn't find a card with name " + rc.name + ". Adding it."
  //     );

  //     allCards.data.children = allCards.data.children.concat([
  //       {
  //         code: rc.id,
  //         title: rc.name,
  //         category: "Ranger",
  //         subcategory: rc.set_name,
  //         image: "https://static.rangersdb.com" + rc.imagesrc,
  //       },
  //     ]);
  //   }
  // });

  // Load the TTS JSON
  // const ttsJsonString = fs.readFileSync(
  //   path.join(rawDir, "Earthborne_Rangers.json")
  // );
  // const ttsJson = JSON.parse(ttsJsonString);

  // const cardObjectStates = ttsJson.ObjectStates.filter(
  //   (os) =>
  //     os.ContainedObjects &&
  //     os.ContainedObjects.some((o) => o.Name === "Card" || o.Name === "Deck")
  // )
  //   .filter((os) => os.Nickname !== "Pre-made Rangers")
  //   .map((os) => {
  //     if (os.GUID === "875d54") {
  //       os.Nickname = "Locations";
  //     } else if (os.GUID === "6b003b") {
  //       os.Nickname = "Challenge Cards";
  //     } else if (os.GUID === "45db72") {
  //       os.Nickname = "Path, Reward, Malady cards";
  //     }
  //     return os;
  //   });

  // Write out the card names
  // const printIndex = 6;

  // const imageMap = {};

  // cardObjectStates.forEach((cos, cosIndex) => {
  //   if (cosIndex !== printIndex) return;

  //   console.log(
  //     "working with " +
  //       cos.Nickname +
  //       " (" +
  //       cos.GUID +
  //       ", " +
  //       cos.ContainedObjects.length +
  //       " items)"
  //   );
  //   let output = [];
  //   cos.ContainedObjects.forEach((co, index) => {
  //     if (co.Name === "Card") {
  //       if (!co.Nickname) {
  //         co.Nickname = `${index} ${cos.Nickname}`;
  //       }

  //       if (!co.CustomDeck) {
  //         console.log("No custom deck for " + co.Nickname);
  //         return;
  //       }

  //       Object.values(co.CustomDeck).forEach((v) => {
  //         imageMap[v.FaceURL] = true;
  //         imageMap[v.BackURL] = true;
  //       });

  //       //remove trailing number from card
  //       const nameParts = co.Nickname.split(" ");
  //       if (Number.parseInt(nameParts[nameParts.length - 1])) {
  //         co.Nickname = nameParts.slice(0, -1).join(" ");
  //       }

  //       // console.log("Found Card " + co.Nickname);
  //     }
  //   });

  // console.log(output);

  // fs.writeFileSync(
  //   path.join(setsDir, `images.json`),
  //   JSON.stringify(Object.keys(imageMap), null, 4)
  // );

  // fs.writeFileSync(
  //   path.join(setsDir, `${cos.Nickname}.json`),
  //   JSON.stringify(output, null, 4)
  // );
  // });

  // const tagMap = {};
  // const tagMapCounts = {};

  // cardObjectStates[0].ContainedObjects.forEach((co) => {
  //   const tag = co.Tags[0];
  //   if (tagMap[tag]) {
  //     tagMap[tag] = tagMap[tag].concat([co]);
  //     tagMapCounts[tag]++;
  //   } else {
  //     tagMap[tag] = [co];
  //     tagMapCounts[tag] = 1;
  //   }
  // });

  // console.log(Object.keys(tagMapCounts).length);
  // console.log(tagMapCounts);

  // console.log(
  //   cardObjectStates[0].ContainedObjects.filter(
  //     (co) => co.Tags[0] === "rewa_memory_object"
  //   ).map((co) => ({
  //     thing: co.Name,
  //     name: co.Nickname,
  //     tags: co.Tags,
  //   }))
  // );

  // fs.writeFileSync(
  //   path.join(setsDir, "sets.json"),
  //   JSON.stringify(sets.data.data.sets, null, 4)
  // );

  fs.writeFileSync(
    path.join(rawDir, "allCards.json"),
    JSON.stringify(allCards.data.children, null, 4)
  );

  fs.writeFileSync(
    path.join(rawDir, "rangerCards.json"),
    JSON.stringify(rangerCards.data.data.cards, null, 4)
  );

  // Now load the ranger cards and annotate
  const rangerFiles = fs
    .readdirSync(path.join(setsDir, "ranger"))
    .map((f) => path.join(setsDir, "ranger", f));

  rangerFiles.push(path.join(setsDir, "rewards.json"));
  rangerFiles.forEach((file) => {
    const rangerCardsFromFile = JSON.parse(fs.readFileSync(file));

    rangerCardsFromFile.forEach((c) => {
      const rc = rangerCardMap[c.name];
      if (rc) {
        if (rc.mapped) {
          console.log("WARNING - Already mapping " + c.name);
        }

        c.code = rangerCardMap[c.name].id;
        rangerCardMap[c.name].mapped = true;
      } else {
        console.log(
          `ERROR - didn't find rangersdb entry for ${c.name} in ${file}`
        );
      }
    });

    fs.writeFileSync(file, JSON.stringify(rangerCardsFromFile, null, 4));
  });

  // See if there were any cards that were from rangersdb but weren't found in local files
  Object.values(rangerCardMap).forEach((rc) => {
    if (!rc.mapped) {
      console.log(`WARNING - never mapped ${rc.name}`);
    }
  });
};

try {
  doImport();
} catch (e) {
  console.log(`ERROR`);
}
