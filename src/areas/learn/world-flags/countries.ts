// Static country data for the World Flags Flash Card Game
// Includes all ~195 UN-recognized sovereign states

export interface Country {
  code: string;
  name: string;
  flag: string;
  continent: string;
  capital: string;
  landmark: string;
  currency: string;
  currencySymbol: string;
  funFact: string;
}

export const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
] as const;

export const COUNTRIES: Country[] = [
  // ============================================================
  // AFRICA (54 countries)
  // ============================================================
  {
    code: 'DZ',
    name: 'Algeria',
    flag: '🇩🇿',
    continent: 'Africa',
    capital: 'Algiers',
    landmark: 'Maqam Echahid',
    currency: 'Algerian Dinar',
    currencySymbol: 'د.ج',
    funFact: 'Algeria is the largest country in Africa by land area.',
  },
  {
    code: 'AO',
    name: 'Angola',
    flag: '🇦🇴',
    continent: 'Africa',
    capital: 'Luanda',
    landmark: 'Kalandula Falls',
    currency: 'Angolan Kwanza',
    currencySymbol: 'Kz',
    funFact: 'Angola is home to one of the largest waterfalls in Africa.',
  },
  {
    code: 'BJ',
    name: 'Benin',
    flag: '🇧🇯',
    continent: 'Africa',
    capital: 'Porto-Novo',
    landmark: 'Royal Palaces of Abomey',
    currency: 'West African CFA Franc',
    currencySymbol: 'CFA',
    funFact: 'Benin was once called Dahomey and was famous for its warrior women.',
  },
  {
    code: 'BW',
    name: 'Botswana',
    flag: '🇧🇼',
    continent: 'Africa',
    capital: 'Gaborone',
    landmark: 'Chobe National Park',
    currency: 'Botswana Pula',
    currencySymbol: 'P',
    funFact: 'The Okavango Delta is the largest inland delta in the world.',
  },
  {
    code: 'BF',
    name: 'Burkina Faso',
    flag: '🇧🇫',
    continent: 'Africa',
    capital: 'Ouagadougou',
    landmark: 'Ouagadougou Cathedral',
    currency: 'West African CFA Franc',
    currencySymbol: 'CFA',
    funFact: 'The country name means "Land of Honest People" in local languages.',
  },
  {
    code: 'BI',
    name: 'Burundi',
    flag: '🇧🇮',
    continent: 'Africa',
    capital: 'Gitega',
    landmark: 'Livingstone-Stanley Monument',
    currency: 'Burundian Franc',
    currencySymbol: 'FBu',
    funFact: 'Burundi is one of the smallest countries in Africa.',
  },
  {
    code: 'CV',
    name: 'Cabo Verde',
    flag: '🇨🇻',
    continent: 'Africa',
    capital: 'Praia',
    landmark: 'Pico do Fogo',
    currency: 'Cape Verdean Escudo',
    currencySymbol: '$',
    funFact: 'Cabo Verde is a group of 10 volcanic islands in the Atlantic Ocean.',
  },
  {
    code: 'CM',
    name: 'Cameroon',
    flag: '🇨🇲',
    continent: 'Africa',
    capital: 'Yaoundé',
    landmark: 'Mount Cameroon',
    currency: 'Central African CFA Franc',
    currencySymbol: 'FCFA',
    funFact: 'Cameroon is called "Africa in miniature" because it has all of Africa\'s landscapes.',
  },
  {
    code: 'CF',
    name: 'Central African Republic',
    flag: '🇨🇫',
    continent: 'Africa',
    capital: 'Bangui',
    landmark: 'Bangui',
    currency: 'Central African CFA Franc',
    currencySymbol: 'FCFA',
    funFact: 'The Central African Republic is home to lowland gorillas and forest elephants.',
  },
  {
    code: 'TD',
    name: 'Chad',
    flag: '🇹🇩',
    continent: 'Africa',
    capital: "N'Djamena",
    landmark: 'Aloba Arch',
    currency: 'Central African CFA Franc',
    currencySymbol: 'FCFA',
    funFact: 'Chad has an enormous lake that has been shrinking over the years.',
  },
  {
    code: 'KM',
    name: 'Comoros',
    flag: '🇰🇲',
    continent: 'Africa',
    capital: 'Moroni',
    landmark: 'Mount Karthala',
    currency: 'Comorian Franc',
    currencySymbol: 'CF',
    funFact: "Comoros is one of the world's largest producers of ylang-ylang, used in perfumes.",
  },
  {
    code: 'CG',
    name: 'Congo',
    flag: '🇨🇬',
    continent: 'Africa',
    capital: 'Brazzaville',
    landmark: 'Brazzaville',
    currency: 'Central African CFA Franc',
    currencySymbol: 'FCFA',
    funFact:
      'Brazzaville and Kinshasa are the closest capital cities in the world, separated by a river.',
  },
  {
    code: 'CD',
    name: 'Democratic Republic of the Congo',
    flag: '🇨🇩',
    continent: 'Africa',
    capital: 'Kinshasa',
    landmark: 'Nyiragongo',
    currency: 'Congolese Franc',
    currencySymbol: 'FC',
    funFact: 'The Congo River is the deepest river in the world.',
  },
  {
    code: 'CI',
    name: "Côte d'Ivoire",
    flag: '🇨🇮',
    continent: 'Africa',
    capital: 'Yamoussoukro',
    landmark: 'Basilica of Our Lady of Peace',
    currency: 'West African CFA Franc',
    currencySymbol: 'CFA',
    funFact: "Côte d'Ivoire is the world's largest producer of cocoa beans used to make chocolate.",
  },
  {
    code: 'DJ',
    name: 'Djibouti',
    flag: '🇩🇯',
    continent: 'Africa',
    capital: 'Djibouti',
    landmark: 'Lake Assal (Djibouti)',
    currency: 'Djiboutian Franc',
    currencySymbol: 'Fdj',
    funFact:
      'Lake Assal in Djibouti is the lowest point in Africa and one of the saltiest lakes on Earth.',
  },
  {
    code: 'EG',
    name: 'Egypt',
    flag: '🇪🇬',
    continent: 'Africa',
    capital: 'Cairo',
    landmark: 'Great Pyramids of Giza',
    currency: 'Egyptian Pound',
    currencySymbol: '£',
    funFact: 'The ancient Egyptians invented toothpaste and paper made from papyrus reeds.',
  },
  {
    code: 'GQ',
    name: 'Equatorial Guinea',
    flag: '🇬🇶',
    continent: 'Africa',
    capital: 'Malabo',
    landmark: 'Malabo',
    currency: 'Central African CFA Franc',
    currencySymbol: 'FCFA',
    funFact:
      'Equatorial Guinea is the only country in Africa where Spanish is an official language.',
  },
  {
    code: 'ER',
    name: 'Eritrea',
    flag: '🇪🇷',
    continent: 'Africa',
    capital: 'Asmara',
    landmark: 'Fiat Tagliero Building',
    currency: 'Eritrean Nakfa',
    currencySymbol: 'Nfk',
    funFact: 'Asmara is known as "Little Rome" because of its beautiful Italian-style buildings.',
  },
  {
    code: 'SZ',
    name: 'Eswatini',
    flag: '🇸🇿',
    continent: 'Africa',
    capital: 'Mbabane',
    landmark: 'Malolotja Nature Reserve',
    currency: 'Swazi Lilangeni',
    currencySymbol: 'E',
    funFact: 'Eswatini is one of the last absolute monarchies in the world.',
  },
  {
    code: 'ET',
    name: 'Ethiopia',
    flag: '🇪🇹',
    continent: 'Africa',
    capital: 'Addis Ababa',
    landmark: 'Church of Saint George, Lalibela',
    currency: 'Ethiopian Birr',
    currencySymbol: 'Br',
    funFact: 'Ethiopia has its own calendar that is about 7 years behind the western calendar.',
  },
  {
    code: 'GA',
    name: 'Gabon',
    flag: '🇬🇦',
    continent: 'Africa',
    capital: 'Libreville',
    landmark: 'Lopé National Park',
    currency: 'Central African CFA Franc',
    currencySymbol: 'FCFA',
    funFact: 'About 80% of Gabon is covered in rainforest, home to gorillas and forest elephants.',
  },
  {
    code: 'GM',
    name: 'Gambia',
    flag: '🇬🇲',
    continent: 'Africa',
    capital: 'Banjul',
    landmark: 'Arch 22',
    currency: 'Gambian Dalasi',
    currencySymbol: 'D',
    funFact: 'The Gambia is the smallest country on mainland Africa.',
  },
  {
    code: 'GH',
    name: 'Ghana',
    flag: '🇬🇭',
    continent: 'Africa',
    capital: 'Accra',
    landmark: 'Black Star Gate',
    currency: 'Ghanaian Cedi',
    currencySymbol: '₵',
    funFact: 'Ghana was the first country in sub-Saharan Africa to gain independence.',
  },
  {
    code: 'GN',
    name: 'Guinea',
    flag: '🇬🇳',
    continent: 'Africa',
    capital: 'Conakry',
    landmark: 'Mount Nimba',
    currency: 'Guinean Franc',
    currencySymbol: 'FG',
    funFact:
      'Guinea is sometimes called the "water tower of West Africa" because many rivers start there.',
  },
  {
    code: 'GW',
    name: 'Guinea-Bissau',
    flag: '🇬🇼',
    continent: 'Africa',
    capital: 'Bissau',
    landmark: 'Fortaleza de São José da Amura',
    currency: 'West African CFA Franc',
    currencySymbol: 'CFA',
    funFact: 'The Bijagós Islands are home to hippos that swim in the ocean.',
  },
  {
    code: 'KE',
    name: 'Kenya',
    flag: '🇰🇪',
    continent: 'Africa',
    capital: 'Nairobi',
    landmark: 'Mount Kenya',
    currency: 'Kenyan Shilling',
    currencySymbol: 'KSh',
    funFact:
      'Kenya is famous for the Great Wildebeest Migration, where millions of animals travel across the savanna.',
  },
  {
    code: 'LS',
    name: 'Lesotho',
    flag: '🇱🇸',
    continent: 'Africa',
    capital: 'Maseru',
    landmark: 'Maletsunyane Falls',
    currency: 'Lesotho Loti',
    currencySymbol: 'L',
    funFact: 'Lesotho is the only country in the world entirely above 1,000 meters in elevation.',
  },
  {
    code: 'LR',
    name: 'Liberia',
    flag: '🇱🇷',
    continent: 'Africa',
    capital: 'Monrovia',
    landmark: 'Ducor Hotel',
    currency: 'Liberian Dollar',
    currencySymbol: 'L$',
    funFact:
      'Liberia was founded by freed American slaves and its capital is named after US President James Monroe.',
  },
  {
    code: 'LY',
    name: 'Libya',
    flag: '🇱🇾',
    continent: 'Africa',
    capital: 'Tripoli',
    landmark: 'Leptis Magna',
    currency: 'Libyan Dinar',
    currencySymbol: 'ل.د',
    funFact:
      'Libya is home to ancient Roman ruins, including one of the best-preserved Roman cities in the world.',
  },
  {
    code: 'MG',
    name: 'Madagascar',
    flag: '🇲🇬',
    continent: 'Africa',
    capital: 'Antananarivo',
    landmark: 'Avenue of the Baobabs',
    currency: 'Malagasy Ariary',
    currencySymbol: 'Ar',
    funFact: 'About 90% of the plants and animals in Madagascar are found nowhere else on Earth.',
  },
  {
    code: 'MW',
    name: 'Malawi',
    flag: '🇲🇼',
    continent: 'Africa',
    capital: 'Lilongwe',
    landmark: 'Cape Maclear',
    currency: 'Malawian Kwacha',
    currencySymbol: 'MK',
    funFact: 'Lake Malawi has more species of fish than any other lake in the world.',
  },
  {
    code: 'ML',
    name: 'Mali',
    flag: '🇲🇱',
    continent: 'Africa',
    capital: 'Bamako',
    landmark: 'Great Mosque of Djenné',
    currency: 'West African CFA Franc',
    currencySymbol: 'CFA',
    funFact: 'The Great Mosque of Djenné is the largest mud-brick building in the world.',
  },
  {
    code: 'MR',
    name: 'Mauritania',
    flag: '🇲🇷',
    continent: 'Africa',
    capital: 'Nouakchott',
    landmark: 'Chinguetti',
    currency: 'Mauritanian Ouguiya',
    currencySymbol: 'UM',
    funFact:
      'Mauritania has a giant circular rock formation in the desert visible from space called the Eye of Africa.',
  },
  {
    code: 'MU',
    name: 'Mauritius',
    flag: '🇲🇺',
    continent: 'Africa',
    capital: 'Port Louis',
    landmark: 'Le Morne Brabant',
    currency: 'Mauritian Rupee',
    currencySymbol: '₨',
    funFact:
      'Mauritius was the only home of the famous dodo bird, which went extinct in the 1600s.',
  },
  {
    code: 'MA',
    name: 'Morocco',
    flag: '🇲🇦',
    continent: 'Africa',
    capital: 'Rabat',
    landmark: 'Hassan II Mosque',
    currency: 'Moroccan Dirham',
    currencySymbol: 'MAD',
    funFact:
      "Morocco is home to the world's oldest university, the University of al-Qarawiyyin, founded in 859 AD.",
  },
  {
    code: 'MZ',
    name: 'Mozambique',
    flag: '🇲🇿',
    continent: 'Africa',
    capital: 'Maputo',
    landmark: 'Island of Mozambique',
    currency: 'Mozambican Metical',
    currencySymbol: 'MT',
    funFact:
      "Mozambique's flag features an AK-47 rifle, making it the only national flag with a modern firearm.",
  },
  {
    code: 'NA',
    name: 'Namibia',
    flag: '🇳🇦',
    continent: 'Africa',
    capital: 'Windhoek',
    landmark: 'Sossusvlei',
    currency: 'Namibian Dollar',
    currencySymbol: 'N$',
    funFact:
      'Namibia has some of the tallest sand dunes in the world, reaching over 300 meters high.',
  },
  {
    code: 'NE',
    name: 'Niger',
    flag: '🇳🇪',
    continent: 'Africa',
    capital: 'Niamey',
    landmark: 'Agadez Mosque',
    currency: 'West African CFA Franc',
    currencySymbol: 'CFA',
    funFact: 'Niger is named after the Niger River, the third-longest river in Africa.',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    continent: 'Africa',
    capital: 'Abuja',
    landmark: 'Zuma Rock',
    currency: 'Nigerian Naira',
    currencySymbol: '₦',
    funFact: 'Nigeria has over 500 different languages spoken!',
  },
  {
    code: 'RW',
    name: 'Rwanda',
    flag: '🇷🇼',
    continent: 'Africa',
    capital: 'Kigali',
    landmark: 'Kigali Genocide Memorial',
    currency: 'Rwandan Franc',
    currencySymbol: 'RF',
    funFact:
      'Rwanda is called the "Land of a Thousand Hills" because of its beautiful rolling hills.',
  },
  {
    code: 'ST',
    name: 'São Tomé and Príncipe',
    flag: '🇸🇹',
    continent: 'Africa',
    capital: 'São Tomé',
    landmark: 'Pico de São Tomé',
    currency: 'São Tomé and Príncipe Dobra',
    currencySymbol: 'Db',
    funFact: 'São Tomé and Príncipe is the smallest country in Africa.',
  },
  {
    code: 'SN',
    name: 'Senegal',
    flag: '🇸🇳',
    continent: 'Africa',
    capital: 'Dakar',
    landmark: 'African Renaissance Monument',
    currency: 'West African CFA Franc',
    currencySymbol: 'CFA',
    funFact: 'Senegal has a pink lake called Lake Retba that gets its color from special algae.',
  },
  {
    code: 'SC',
    name: 'Seychelles',
    flag: '🇸🇨',
    continent: 'Africa',
    capital: 'Victoria',
    landmark: "Anse Source d'Argent",
    currency: 'Seychellois Rupee',
    currencySymbol: '₨',
    funFact: 'Seychelles is home to the largest seed in the world, the coco de mer.',
  },
  {
    code: 'SL',
    name: 'Sierra Leone',
    flag: '🇸🇱',
    continent: 'Africa',
    capital: 'Freetown',
    landmark: 'Cotton Tree (Freetown)',
    currency: 'Sierra Leonean Leone',
    currencySymbol: 'Le',
    funFact: 'Sierra Leone means "Lion Mountains" in Portuguese.',
  },
  {
    code: 'SO',
    name: 'Somalia',
    flag: '🇸🇴',
    continent: 'Africa',
    capital: 'Mogadishu',
    landmark: 'Mogadishu Cathedral',
    currency: 'Somali Shilling',
    currencySymbol: 'Sh',
    funFact: 'Somalia has the longest coastline of any country on the African mainland.',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    continent: 'Africa',
    capital: 'Pretoria',
    landmark: 'Table Mountain',
    currency: 'South African Rand',
    currencySymbol: 'R',
    funFact: 'South Africa has three capital cities: Pretoria, Cape Town, and Bloemfontein.',
  },
  {
    code: 'SS',
    name: 'South Sudan',
    flag: '🇸🇸',
    continent: 'Africa',
    capital: 'Juba',
    landmark: 'Juba Nile Bridge',
    currency: 'South Sudanese Pound',
    currencySymbol: '£',
    funFact: "South Sudan became the world's newest country in 2011.",
  },
  {
    code: 'SD',
    name: 'Sudan',
    flag: '🇸🇩',
    continent: 'Africa',
    capital: 'Khartoum',
    landmark: 'Pyramids of Meroë',
    currency: 'Sudanese Pound',
    currencySymbol: '£',
    funFact: 'Sudan has more pyramids than Egypt, with over 200 ancient pyramids.',
  },
  {
    code: 'TZ',
    name: 'Tanzania',
    flag: '🇹🇿',
    continent: 'Africa',
    capital: 'Dodoma',
    landmark: 'Mount Kilimanjaro',
    currency: 'Tanzanian Shilling',
    currencySymbol: 'TSh',
    funFact:
      'Mount Kilimanjaro is the tallest mountain in Africa and the tallest free-standing mountain in the world.',
  },
  {
    code: 'TG',
    name: 'Togo',
    flag: '🇹🇬',
    continent: 'Africa',
    capital: 'Lomé',
    landmark: 'Koutammakou',
    currency: 'West African CFA Franc',
    currencySymbol: 'CFA',
    funFact:
      'Togo is home to the Koutammakou landscape, famous for its traditional tower houses made of mud.',
  },
  {
    code: 'TN',
    name: 'Tunisia',
    flag: '🇹🇳',
    continent: 'Africa',
    capital: 'Tunis',
    landmark: 'Amphitheatre of El Jem',
    currency: 'Tunisian Dinar',
    currencySymbol: 'د.ت',
    funFact: 'Parts of the Star Wars movies were filmed in the Tunisian desert.',
  },
  {
    code: 'UG',
    name: 'Uganda',
    flag: '🇺🇬',
    continent: 'Africa',
    capital: 'Kampala',
    landmark: 'Bwindi Impenetrable Forest',
    currency: 'Ugandan Shilling',
    currencySymbol: 'USh',
    funFact: "Uganda is home to half of the world's remaining mountain gorillas.",
  },
  {
    code: 'ZM',
    name: 'Zambia',
    flag: '🇿🇲',
    continent: 'Africa',
    capital: 'Lusaka',
    landmark: 'Victoria Falls',
    currency: 'Zambian Kwacha',
    currencySymbol: 'ZK',
    funFact:
      'Victoria Falls is one of the largest waterfalls in the world and is called "The Smoke That Thunders."',
  },
  {
    code: 'ZW',
    name: 'Zimbabwe',
    flag: '🇿🇼',
    continent: 'Africa',
    capital: 'Harare',
    landmark: 'Great Zimbabwe',
    currency: 'Zimbabwean Dollar',
    currencySymbol: 'Z$',
    funFact: 'Zimbabwe is named after the Great Zimbabwe stone ruins built over 900 years ago.',
  },

  // ============================================================
  // ASIA (48 countries)
  // ============================================================
  {
    code: 'AF',
    name: 'Afghanistan',
    flag: '🇦🇫',
    continent: 'Asia',
    capital: 'Kabul',
    landmark: 'Buddhas of Bamiyan',
    currency: 'Afghan Afghani',
    currencySymbol: '؋',
    funFact:
      'Afghanistan is home to the Hindu Kush mountain range with peaks over 7,000 meters tall.',
  },
  {
    code: 'AM',
    name: 'Armenia',
    flag: '🇦🇲',
    continent: 'Asia',
    capital: 'Yerevan',
    landmark: 'Geghard Monastery',
    currency: 'Armenian Dram',
    currencySymbol: '֏',
    funFact:
      'Armenia was the first country in the world to adopt Christianity as its state religion in 301 AD.',
  },
  {
    code: 'AZ',
    name: 'Azerbaijan',
    flag: '🇦🇿',
    continent: 'Asia',
    capital: 'Baku',
    landmark: 'Maiden Tower (Baku)',
    currency: 'Azerbaijani Manat',
    currencySymbol: '₼',
    funFact:
      'Azerbaijan is known as the "Land of Fire" because of its natural gas flames that burn on hillsides.',
  },
  {
    code: 'BH',
    name: 'Bahrain',
    flag: '🇧🇭',
    continent: 'Asia',
    capital: 'Manama',
    landmark: 'Al Fateh Grand Mosque',
    currency: 'Bahraini Dinar',
    currencySymbol: '.د.ب',
    funFact: 'Bahrain is an island nation made up of 33 islands in the Persian Gulf.',
  },
  {
    code: 'BD',
    name: 'Bangladesh',
    flag: '🇧🇩',
    continent: 'Asia',
    capital: 'Dhaka',
    landmark: 'Ahsan Manzil',
    currency: 'Bangladeshi Taka',
    currencySymbol: '৳',
    funFact:
      'Bangladesh is home to the Sundarbans, the largest mangrove forest in the world and home to Bengal tigers.',
  },
  {
    code: 'BT',
    name: 'Bhutan',
    flag: '🇧🇹',
    continent: 'Asia',
    capital: 'Thimphu',
    landmark: "Tiger's Nest Monastery",
    currency: 'Bhutanese Ngultrum',
    currencySymbol: 'Nu',
    funFact: 'Bhutan measures its success by "Gross National Happiness" instead of just money.',
  },
  {
    code: 'BN',
    name: 'Brunei',
    flag: '🇧🇳',
    continent: 'Asia',
    capital: 'Bandar Seri Begawan',
    landmark: 'Omar Ali Saifuddien Mosque',
    currency: 'Brunei Dollar',
    currencySymbol: 'B$',
    funFact:
      "The Sultan of Brunei's palace has 1,788 rooms, making it the largest residential palace in the world.",
  },
  {
    code: 'KH',
    name: 'Cambodia',
    flag: '🇰🇭',
    continent: 'Asia',
    capital: 'Phnom Penh',
    landmark: 'Angkor Wat',
    currency: 'Cambodian Riel',
    currencySymbol: '៛',
    funFact:
      "Angkor Wat is the largest religious monument in the world and appears on Cambodia's flag.",
  },
  {
    code: 'CN',
    name: 'China',
    flag: '🇨🇳',
    continent: 'Asia',
    capital: 'Beijing',
    landmark: 'Great Wall of China',
    currency: 'Chinese Yuan',
    currencySymbol: '¥',
    funFact:
      'The Great Wall of China is so long it would stretch from New York to Los Angeles and back.',
  },
  {
    code: 'CY',
    name: 'Cyprus',
    flag: '🇨🇾',
    continent: 'Asia',
    capital: 'Nicosia',
    landmark: 'Tombs of the Kings (Paphos)',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Cyprus is the third largest island in the Mediterranean Sea.',
  },
  {
    code: 'GE',
    name: 'Georgia',
    flag: '🇬🇪',
    continent: 'Asia',
    capital: 'Tbilisi',
    landmark: 'Gergeti Trinity Church',
    currency: 'Georgian Lari',
    currencySymbol: '₾',
    funFact:
      'Georgia is one of the oldest wine-producing regions in the world, making wine for over 8,000 years.',
  },
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    continent: 'Asia',
    capital: 'New Delhi',
    landmark: 'Taj Mahal',
    currency: 'Indian Rupee',
    currencySymbol: '₹',
    funFact: 'India invented the number system we use today, including the concept of zero.',
  },
  {
    code: 'ID',
    name: 'Indonesia',
    flag: '🇮🇩',
    continent: 'Asia',
    capital: 'Jakarta',
    landmark: 'Borobudur Temple',
    currency: 'Indonesian Rupiah',
    currencySymbol: 'Rp',
    funFact:
      'Indonesia is made up of over 17,000 islands, making it the largest archipelago in the world.',
  },
  {
    code: 'IR',
    name: 'Iran',
    flag: '🇮🇷',
    continent: 'Asia',
    capital: 'Tehran',
    landmark: 'Persepolis',
    currency: 'Iranian Rial',
    currencySymbol: '﷼',
    funFact: "Iran was once called Persia and is home to one of the world's oldest civilizations.",
  },
  {
    code: 'IQ',
    name: 'Iraq',
    flag: '🇮🇶',
    continent: 'Asia',
    capital: 'Baghdad',
    landmark: 'Imam Husayn Shrine',
    currency: 'Iraqi Dinar',
    currencySymbol: 'ع.د',
    funFact:
      'Iraq is home to ancient Mesopotamia, often called the "Cradle of Civilization" where writing was invented.',
  },
  {
    code: 'IL',
    name: 'Israel',
    flag: '🇮🇱',
    continent: 'Asia',
    capital: 'Jerusalem',
    landmark: 'Western Wall',
    currency: 'Israeli New Shekel',
    currencySymbol: '₪',
    funFact:
      'The Dead Sea in Israel is the lowest point on land and so salty you can float without trying.',
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    continent: 'Asia',
    capital: 'Tokyo',
    landmark: 'Mount Fuji',
    currency: 'Japanese Yen',
    currencySymbol: '¥',
    funFact:
      'Japan has more than 6,800 islands and is home to the famous bullet trains that travel at 320 km/h.',
  },
  {
    code: 'JO',
    name: 'Jordan',
    flag: '🇯🇴',
    continent: 'Asia',
    capital: 'Amman',
    landmark: 'Petra',
    currency: 'Jordanian Dinar',
    currencySymbol: 'د.ا',
    funFact:
      'The ancient city of Petra was carved directly into pink sandstone cliffs over 2,000 years ago.',
  },
  {
    code: 'KZ',
    name: 'Kazakhstan',
    flag: '🇰🇿',
    continent: 'Asia',
    capital: 'Astana',
    landmark: 'Bayterek Tower',
    currency: 'Kazakhstani Tenge',
    currencySymbol: '₸',
    funFact: 'Kazakhstan is the largest landlocked country in the world.',
  },
  {
    code: 'KW',
    name: 'Kuwait',
    flag: '🇰🇼',
    continent: 'Asia',
    capital: 'Kuwait City',
    landmark: 'Kuwait Towers',
    currency: 'Kuwaiti Dinar',
    currencySymbol: 'د.ك',
    funFact: 'Kuwait has some of the hottest temperatures on Earth, sometimes reaching over 50°C.',
  },
  {
    code: 'KG',
    name: 'Kyrgyzstan',
    flag: '🇰🇬',
    continent: 'Asia',
    capital: 'Bishkek',
    landmark: 'Issyk-Kul Lake',
    currency: 'Kyrgyzstani Som',
    currencySymbol: 'лв',
    funFact: 'Kyrgyzstan is a mountainous country where eagle hunting is a traditional sport.',
  },
  {
    code: 'LA',
    name: 'Laos',
    flag: '🇱🇦',
    continent: 'Asia',
    capital: 'Vientiane',
    landmark: 'Kuang Si Falls',
    currency: 'Lao Kip',
    currencySymbol: '₭',
    funFact: 'Laos is called the "Land of a Million Elephants" from its ancient kingdom name.',
  },
  {
    code: 'LB',
    name: 'Lebanon',
    flag: '🇱🇧',
    continent: 'Asia',
    capital: 'Beirut',
    landmark: 'Baalbek',
    currency: 'Lebanese Pound',
    currencySymbol: '£',
    funFact:
      "Lebanon's famous cedar tree is on its flag and has been a symbol of the country for thousands of years.",
  },
  {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    continent: 'Asia',
    capital: 'Kuala Lumpur',
    landmark: 'Batu Caves',
    currency: 'Malaysian Ringgit',
    currencySymbol: 'RM',
    funFact:
      "Malaysia's Petronas Towers were the tallest buildings in the world from 1998 to 2004.",
  },
  {
    code: 'MV',
    name: 'Maldives',
    flag: '🇲🇻',
    continent: 'Asia',
    capital: 'Malé',
    landmark: 'Malé',
    currency: 'Maldivian Rufiyaa',
    currencySymbol: 'Rf',
    funFact:
      'The Maldives is the flattest country on Earth, with an average height of just 1.5 meters above sea level.',
  },
  {
    code: 'MN',
    name: 'Mongolia',
    flag: '🇲🇳',
    continent: 'Asia',
    capital: 'Ulaanbaatar',
    landmark: 'Genghis Khan Equestrian Statue',
    currency: 'Mongolian Tögrög',
    currencySymbol: '₮',
    funFact:
      'Mongolia is the least densely populated country in the world, with vast open grasslands.',
  },
  {
    code: 'MM',
    name: 'Myanmar',
    flag: '🇲🇲',
    continent: 'Asia',
    capital: 'Naypyidaw',
    landmark: 'Shwedagon Pagoda',
    currency: 'Myanmar Kyat',
    currencySymbol: 'K',
    funFact:
      "Myanmar's Shwedagon Pagoda is covered in real gold and topped with thousands of diamonds.",
  },
  {
    code: 'NP',
    name: 'Nepal',
    flag: '🇳🇵',
    continent: 'Asia',
    capital: 'Kathmandu',
    landmark: 'Mount Everest',
    currency: 'Nepalese Rupee',
    currencySymbol: '₨',
    funFact:
      'Nepal is home to Mount Everest, the tallest mountain in the world, and has the only non-rectangular national flag.',
  },
  {
    code: 'KP',
    name: 'North Korea',
    flag: '🇰🇵',
    continent: 'Asia',
    capital: 'Pyongyang',
    landmark: 'Juche Tower',
    currency: 'North Korean Won',
    currencySymbol: '₩',
    funFact: 'North Korea has its own calendar system that starts from 1912.',
  },
  {
    code: 'OM',
    name: 'Oman',
    flag: '🇴🇲',
    continent: 'Asia',
    capital: 'Muscat',
    landmark: 'Sultan Qaboos Grand Mosque',
    currency: 'Omani Rial',
    currencySymbol: '﷼',
    funFact:
      'Oman has beautiful fjords and was a major seafaring nation trading across the Indian Ocean.',
  },
  {
    code: 'PK',
    name: 'Pakistan',
    flag: '🇵🇰',
    continent: 'Asia',
    capital: 'Islamabad',
    landmark: 'Badshahi Mosque',
    currency: 'Pakistani Rupee',
    currencySymbol: '₨',
    funFact: 'Pakistan is home to K2, the second tallest mountain in the world.',
  },
  {
    code: 'PS',
    name: 'Palestine',
    flag: '🇵🇸',
    continent: 'Asia',
    capital: 'Ramallah',
    landmark: 'Church of the Nativity',
    currency: 'Israeli New Shekel',
    currencySymbol: '₪',
    funFact:
      'Palestine is home to Jericho, believed to be one of the oldest continuously inhabited cities in the world.',
  },
  {
    code: 'PH',
    name: 'Philippines',
    flag: '🇵🇭',
    continent: 'Asia',
    capital: 'Manila',
    landmark: 'Banaue Rice Terraces',
    currency: 'Philippine Peso',
    currencySymbol: '₱',
    funFact:
      "The Philippines has over 7,600 islands and is home to the world's smallest primate, the tarsier.",
  },
  {
    code: 'QA',
    name: 'Qatar',
    flag: '🇶🇦',
    continent: 'Asia',
    capital: 'Doha',
    landmark: 'Museum of Islamic Art, Doha',
    currency: 'Qatari Riyal',
    currencySymbol: '﷼',
    funFact: 'Qatar is one of the richest countries in the world per person.',
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    continent: 'Asia',
    capital: 'Riyadh',
    landmark: 'Masjid al-Haram',
    currency: 'Saudi Riyal',
    currencySymbol: '﷼',
    funFact:
      "Saudi Arabia has no rivers and is home to the Rub' al Khali, the largest sand desert in the world.",
  },
  {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    continent: 'Asia',
    capital: 'Singapore',
    landmark: 'Marina Bay Sands',
    currency: 'Singapore Dollar',
    currencySymbol: 'S$',
    funFact: 'Singapore is a city, country, and island all at the same time.',
  },
  {
    code: 'KR',
    name: 'South Korea',
    flag: '🇰🇷',
    continent: 'Asia',
    capital: 'Seoul',
    landmark: 'Gyeongbokgung Palace',
    currency: 'South Korean Won',
    currencySymbol: '₩',
    funFact: "South Korea invented the world's first metal movable type printing press.",
  },
  {
    code: 'LK',
    name: 'Sri Lanka',
    flag: '🇱🇰',
    continent: 'Asia',
    capital: 'Sri Jayawardenepura Kotte',
    landmark: 'Sigiriya Rock Fortress',
    currency: 'Sri Lankan Rupee',
    currencySymbol: '₨',
    funFact:
      'Sri Lanka is called the "Pearl of the Indian Ocean" and is famous for its tea and gems.',
  },
  {
    code: 'SY',
    name: 'Syria',
    flag: '🇸🇾',
    continent: 'Asia',
    capital: 'Damascus',
    landmark: 'Umayyad Mosque',
    currency: 'Syrian Pound',
    currencySymbol: '£',
    funFact: 'Damascus is one of the oldest continuously inhabited cities in the world.',
  },
  {
    code: 'TJ',
    name: 'Tajikistan',
    flag: '🇹🇯',
    continent: 'Asia',
    capital: 'Dushanbe',
    landmark: 'Ismoil Somoni Peak',
    currency: 'Tajikistani Somoni',
    currencySymbol: 'SM',
    funFact: 'More than 90% of Tajikistan is covered by mountains.',
  },
  {
    code: 'TH',
    name: 'Thailand',
    flag: '🇹🇭',
    continent: 'Asia',
    capital: 'Bangkok',
    landmark: 'Grand Palace',
    currency: 'Thai Baht',
    currencySymbol: '฿',
    funFact:
      'Thailand is the only Southeast Asian country that was never colonized by a European power.',
  },
  {
    code: 'TL',
    name: 'Timor-Leste',
    flag: '🇹🇱',
    continent: 'Asia',
    capital: 'Dili',
    landmark: 'Dili',
    currency: 'United States Dollar',
    currencySymbol: '$',
    funFact:
      'Timor-Leste is one of the youngest countries in the world, gaining independence in 2002.',
  },
  {
    code: 'TR',
    name: 'Turkey',
    flag: '🇹🇷',
    continent: 'Asia',
    capital: 'Ankara',
    landmark: 'Hagia Sophia',
    currency: 'Turkish Lira',
    currencySymbol: '₺',
    funFact: 'Turkey spans two continents, with part of the country in Europe and part in Asia.',
  },
  {
    code: 'TM',
    name: 'Turkmenistan',
    flag: '🇹🇲',
    continent: 'Asia',
    capital: 'Ashgabat',
    landmark: 'Darvaza gas crater',
    currency: 'Turkmenistani Manat',
    currencySymbol: 'T',
    funFact:
      'Turkmenistan has a flaming gas crater called the "Door to Hell" that has been burning since 1971.',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    continent: 'Asia',
    capital: 'Abu Dhabi',
    landmark: 'Burj Khalifa',
    currency: 'UAE Dirham',
    currencySymbol: 'د.إ',
    funFact: 'The Burj Khalifa in Dubai is the tallest building in the world at over 828 meters.',
  },
  {
    code: 'UZ',
    name: 'Uzbekistan',
    flag: '🇺🇿',
    continent: 'Asia',
    capital: 'Tashkent',
    landmark: 'Registan',
    currency: 'Uzbekistani Som',
    currencySymbol: 'сўм',
    funFact:
      'Uzbekistan was an important stop on the ancient Silk Road trade route between China and Europe.',
  },
  {
    code: 'VN',
    name: 'Vietnam',
    flag: '🇻🇳',
    continent: 'Asia',
    capital: 'Hanoi',
    landmark: 'Ha Long Bay',
    currency: 'Vietnamese Dong',
    currencySymbol: '₫',
    funFact:
      'Ha Long Bay has nearly 2,000 limestone islands and islets rising from emerald green waters.',
  },
  {
    code: 'YE',
    name: 'Yemen',
    flag: '🇾🇪',
    continent: 'Asia',
    capital: 'Sanaa',
    landmark: "Old City of Sana'a",
    currency: 'Yemeni Rial',
    currencySymbol: '﷼',
    funFact:
      'Yemen is home to Socotra Island, which has plants found nowhere else on Earth, like the dragon blood tree.',
  },

  // ============================================================
  // EUROPE (44 countries)
  // ============================================================
  {
    code: 'AL',
    name: 'Albania',
    flag: '🇦🇱',
    continent: 'Europe',
    capital: 'Tirana',
    landmark: 'Berat Castle',
    currency: 'Albanian Lek',
    currencySymbol: 'L',
    funFact:
      'Albanians nod their head to say "no" and shake it to say "yes," which is the opposite of most countries.',
  },
  {
    code: 'AD',
    name: 'Andorra',
    flag: '🇦🇩',
    continent: 'Europe',
    capital: 'Andorra la Vella',
    landmark: 'Madriu-Perafita-Claror Valley',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Andorra is a tiny country in the mountains between France and Spain with no airport.',
  },
  {
    code: 'AT',
    name: 'Austria',
    flag: '🇦🇹',
    continent: 'Europe',
    capital: 'Vienna',
    landmark: 'Schönbrunn Palace',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Austria is the birthplace of the famous composer Wolfgang Amadeus Mozart.',
  },
  {
    code: 'BY',
    name: 'Belarus',
    flag: '🇧🇾',
    continent: 'Europe',
    capital: 'Minsk',
    landmark: 'Mir Castle',
    currency: 'Belarusian Ruble',
    currencySymbol: 'Br',
    funFact:
      'Belarus has one of the last ancient forests in Europe, called Białowieża Forest, home to European bison.',
  },
  {
    code: 'BE',
    name: 'Belgium',
    flag: '🇧🇪',
    continent: 'Europe',
    capital: 'Brussels',
    landmark: 'Grand Place',
    currency: 'Euro',
    currencySymbol: '€',
    funFact:
      'Belgium is famous for its chocolate and makes over 220,000 tonnes of chocolate every year.',
  },
  {
    code: 'BA',
    name: 'Bosnia and Herzegovina',
    flag: '🇧🇦',
    continent: 'Europe',
    capital: 'Sarajevo',
    landmark: 'Stari Most',
    currency: 'Bosnia and Herzegovina Convertible Mark',
    currencySymbol: 'KM',
    funFact:
      'Bosnia has a beautiful old bridge in Mostar that was rebuilt after being destroyed in a war.',
  },
  {
    code: 'BG',
    name: 'Bulgaria',
    flag: '🇧🇬',
    continent: 'Europe',
    capital: 'Sofia',
    landmark: 'Rila Monastery',
    currency: 'Bulgarian Lev',
    currencySymbol: 'лв',
    funFact:
      'Bulgaria invented the Cyrillic alphabet that is used in Russian and many other languages.',
  },
  {
    code: 'HR',
    name: 'Croatia',
    flag: '🇭🇷',
    continent: 'Europe',
    capital: 'Zagreb',
    landmark: 'Plitvice Lakes',
    currency: 'Euro',
    currencySymbol: '€',
    funFact:
      'The necktie was invented in Croatia and gets its name from the Croatian word "kravata."',
  },
  {
    code: 'CZ',
    name: 'Czech Republic',
    flag: '🇨🇿',
    continent: 'Europe',
    capital: 'Prague',
    landmark: 'Prague Castle',
    currency: 'Czech Koruna',
    currencySymbol: 'Kč',
    funFact: 'Prague Castle is the largest ancient castle complex in the world.',
  },
  {
    code: 'DK',
    name: 'Denmark',
    flag: '🇩🇰',
    continent: 'Europe',
    capital: 'Copenhagen',
    landmark: 'The Little Mermaid (statue)',
    currency: 'Danish Krone',
    currencySymbol: 'kr',
    funFact: "Denmark's flag is the oldest national flag still in use, dating back to 1219.",
  },
  {
    code: 'EE',
    name: 'Estonia',
    flag: '🇪🇪',
    continent: 'Europe',
    capital: 'Tallinn',
    landmark: 'Tallinn Old Town',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Estonia is one of the most digitally advanced countries: you can even vote online.',
  },
  {
    code: 'FI',
    name: 'Finland',
    flag: '🇫🇮',
    continent: 'Europe',
    capital: 'Helsinki',
    landmark: 'Suomenlinna',
    currency: 'Euro',
    currencySymbol: '€',
    funFact:
      'Finland has more saunas than cars, with about 3 million saunas for 5.5 million people.',
  },
  {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    continent: 'Europe',
    capital: 'Paris',
    landmark: 'Eiffel Tower',
    currency: 'Euro',
    currencySymbol: '€',
    funFact:
      'France is the most visited country in the world, with about 90 million tourists every year.',
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    continent: 'Europe',
    capital: 'Berlin',
    landmark: 'Brandenburg Gate',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Germany is the birthplace of the printing press, gummy bears, and the automobile.',
  },
  {
    code: 'GR',
    name: 'Greece',
    flag: '🇬🇷',
    continent: 'Europe',
    capital: 'Athens',
    landmark: 'Parthenon',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'The Olympic Games were invented in ancient Greece over 2,700 years ago.',
  },
  {
    code: 'HU',
    name: 'Hungary',
    flag: '🇭🇺',
    continent: 'Europe',
    capital: 'Budapest',
    landmark: 'Hungarian Parliament Building',
    currency: 'Hungarian Forint',
    currencySymbol: 'Ft',
    funFact: "Hungary invented the Rubik's Cube, one of the most popular puzzles in the world.",
  },
  {
    code: 'IS',
    name: 'Iceland',
    flag: '🇮🇸',
    continent: 'Europe',
    capital: 'Reykjavik',
    landmark: 'Gullfoss',
    currency: 'Icelandic Króna',
    currencySymbol: 'kr',
    funFact:
      'Iceland has no mosquitoes and you can see the Northern Lights dancing in the sky during winter.',
  },
  {
    code: 'IE',
    name: 'Ireland',
    flag: '🇮🇪',
    continent: 'Europe',
    capital: 'Dublin',
    landmark: 'Cliffs of Moher',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Ireland is known as the "Emerald Isle" because of its lush green countryside.',
  },
  {
    code: 'IT',
    name: 'Italy',
    flag: '🇮🇹',
    continent: 'Europe',
    capital: 'Rome',
    landmark: 'Colosseum',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Italy is shaped like a boot and is the birthplace of pizza and pasta.',
  },
  {
    code: 'XK',
    name: 'Kosovo',
    flag: '🇽🇰',
    continent: 'Europe',
    capital: 'Pristina',
    landmark: 'Gračanica Monastery',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Kosovo is one of the youngest countries in Europe, declaring independence in 2008.',
  },
  {
    code: 'LV',
    name: 'Latvia',
    flag: '🇱🇻',
    continent: 'Europe',
    capital: 'Riga',
    landmark: 'House of the Blackheads (Riga)',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Latvia is home to the widest waterfall in Europe, Venta Rapid.',
  },
  {
    code: 'LI',
    name: 'Liechtenstein',
    flag: '🇱🇮',
    continent: 'Europe',
    capital: 'Vaduz',
    landmark: 'Vaduz Castle',
    currency: 'Swiss Franc',
    currencySymbol: 'CHF',
    funFact:
      'Liechtenstein is so small that you can walk across the entire country in about a day.',
  },
  {
    code: 'LT',
    name: 'Lithuania',
    flag: '🇱🇹',
    continent: 'Europe',
    capital: 'Vilnius',
    landmark: 'Gediminas Tower',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Lithuania has one of the oldest languages in Europe that is still spoken today.',
  },
  {
    code: 'LU',
    name: 'Luxembourg',
    flag: '🇱🇺',
    continent: 'Europe',
    capital: 'Luxembourg City',
    landmark: 'Vianden Castle',
    currency: 'Euro',
    currencySymbol: '€',
    funFact:
      'Luxembourg is one of the smallest countries in Europe but has the highest GDP per person in the world.',
  },
  {
    code: 'MT',
    name: 'Malta',
    flag: '🇲🇹',
    continent: 'Europe',
    capital: 'Valletta',
    landmark: 'Megalithic Temples of Malta',
    currency: 'Euro',
    currencySymbol: '€',
    funFact:
      'Malta has some of the oldest free-standing structures in the world, older than the pyramids.',
  },
  {
    code: 'MD',
    name: 'Moldova',
    flag: '🇲🇩',
    continent: 'Europe',
    capital: 'Chișinău',
    landmark: 'Mileștii Mici',
    currency: 'Moldovan Leu',
    currencySymbol: 'L',
    funFact:
      "Moldova has the world's largest wine cellar with underground streets stretching over 200 km.",
  },
  {
    code: 'MC',
    name: 'Monaco',
    flag: '🇲🇨',
    continent: 'Europe',
    capital: 'Monaco',
    landmark: 'Oceanographic Museum',
    currency: 'Euro',
    currencySymbol: '€',
    funFact:
      'Monaco is the second smallest country in the world and hosts the famous Formula 1 Grand Prix.',
  },
  {
    code: 'ME',
    name: 'Montenegro',
    flag: '🇲🇪',
    continent: 'Europe',
    capital: 'Podgorica',
    landmark: 'Bay of Kotor',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Montenegro means "Black Mountain" and has one of the deepest canyons in Europe.',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    flag: '🇳🇱',
    continent: 'Europe',
    capital: 'Amsterdam',
    landmark: 'Kinderdijk',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'About one-third of the Netherlands is below sea level, protected by dikes and dams.',
  },
  {
    code: 'MK',
    name: 'North Macedonia',
    flag: '🇲🇰',
    continent: 'Europe',
    capital: 'Skopje',
    landmark: 'Ohrid',
    currency: 'Macedonian Denar',
    currencySymbol: 'ден',
    funFact: 'Lake Ohrid is one of the oldest and deepest lakes in Europe.',
  },
  {
    code: 'NO',
    name: 'Norway',
    flag: '🇳🇴',
    continent: 'Europe',
    capital: 'Oslo',
    landmark: 'Geirangerfjord',
    currency: 'Norwegian Krone',
    currencySymbol: 'kr',
    funFact: 'Norway has the longest road tunnel in the world at over 24 kilometers long.',
  },
  {
    code: 'PL',
    name: 'Poland',
    flag: '🇵🇱',
    continent: 'Europe',
    capital: 'Warsaw',
    landmark: 'Wawel Castle',
    currency: 'Polish Złoty',
    currencySymbol: 'zł',
    funFact:
      'Poland is home to the Wieliczka Salt Mine, an underground world of chambers and chapels carved from salt.',
  },
  {
    code: 'PT',
    name: 'Portugal',
    flag: '🇵🇹',
    continent: 'Europe',
    capital: 'Lisbon',
    landmark: 'Tower of Belém',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Portugal is the oldest country in Europe with the same defined borders since 1139.',
  },
  {
    code: 'RO',
    name: 'Romania',
    flag: '🇷🇴',
    continent: 'Europe',
    capital: 'Bucharest',
    landmark: 'Bran Castle',
    currency: 'Romanian Leu',
    currencySymbol: 'lei',
    funFact: 'Romania is home to Bran Castle, which inspired the legend of Count Dracula.',
  },
  {
    code: 'RU',
    name: 'Russia',
    flag: '🇷🇺',
    continent: 'Europe',
    capital: 'Moscow',
    landmark: "Saint Basil's Cathedral",
    currency: 'Russian Ruble',
    currencySymbol: '₽',
    funFact:
      'Russia is the largest country in the world, spanning 11 time zones from Europe to Asia.',
  },
  {
    code: 'SM',
    name: 'San Marino',
    flag: '🇸🇲',
    continent: 'Europe',
    capital: 'San Marino',
    landmark: 'Three Towers of San Marino',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'San Marino claims to be the oldest republic in the world, founded in 301 AD.',
  },
  {
    code: 'RS',
    name: 'Serbia',
    flag: '🇷🇸',
    continent: 'Europe',
    capital: 'Belgrade',
    landmark: 'Belgrade Fortress',
    currency: 'Serbian Dinar',
    currencySymbol: 'дин',
    funFact:
      'Serbia is the birthplace of Nikola Tesla, the famous inventor who helped develop modern electricity.',
  },
  {
    code: 'SK',
    name: 'Slovakia',
    flag: '🇸🇰',
    continent: 'Europe',
    capital: 'Bratislava',
    landmark: 'Bojnice Castle',
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Slovakia has more castles per person than any other country in the world.',
  },
  {
    code: 'SI',
    name: 'Slovenia',
    flag: '🇸🇮',
    continent: 'Europe',
    capital: 'Ljubljana',
    landmark: 'Lake Bled',
    currency: 'Euro',
    currencySymbol: '€',
    funFact:
      'Slovenia has a lake with a tiny island in the middle that has a church with a wishing bell.',
  },
  {
    code: 'ES',
    name: 'Spain',
    flag: '🇪🇸',
    continent: 'Europe',
    capital: 'Madrid',
    landmark: 'Sagrada Familia',
    currency: 'Euro',
    currencySymbol: '€',
    funFact:
      'Spain has a tomato-throwing festival called La Tomatina where people throw thousands of tomatoes at each other.',
  },
  {
    code: 'SE',
    name: 'Sweden',
    flag: '🇸🇪',
    continent: 'Europe',
    capital: 'Stockholm',
    landmark: 'Vasa Museum',
    currency: 'Swedish Krona',
    currencySymbol: 'kr',
    funFact:
      'Sweden has an ice hotel that is rebuilt every winter from blocks of frozen river water.',
  },
  {
    code: 'CH',
    name: 'Switzerland',
    flag: '🇨🇭',
    continent: 'Europe',
    capital: 'Bern',
    landmark: 'Matterhorn',
    currency: 'Swiss Franc',
    currencySymbol: 'CHF',
    funFact: 'Switzerland has four official languages: German, French, Italian, and Romansh.',
  },
  {
    code: 'UA',
    name: 'Ukraine',
    flag: '🇺🇦',
    continent: 'Europe',
    capital: 'Kyiv',
    landmark: 'Saint Sophia Cathedral, Kyiv',
    currency: 'Ukrainian Hryvnia',
    currencySymbol: '₴',
    funFact: 'Ukraine is the largest country located entirely within Europe.',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    continent: 'Europe',
    capital: 'London',
    landmark: 'Big Ben',
    currency: 'Pound Sterling',
    currencySymbol: '£',
    funFact: 'The UK has a queen or king as the head of state.',
  },
  {
    code: 'VA',
    name: 'Vatican City',
    flag: '🇻🇦',
    continent: 'Europe',
    capital: 'Vatican City',
    landmark: "St. Peter's Basilica",
    currency: 'Euro',
    currencySymbol: '€',
    funFact: 'Vatican City is the smallest country in the world, about the size of a golf course.',
  },

  // ============================================================
  // NORTH AMERICA (23 countries)
  // ============================================================
  {
    code: 'AG',
    name: 'Antigua and Barbuda',
    flag: '🇦🇬',
    continent: 'North America',
    capital: "St. John's",
    landmark: "Nelson's Dockyard",
    currency: 'East Caribbean Dollar',
    currencySymbol: 'EC$',
    funFact: 'Antigua and Barbuda has 365 beaches: one for every day of the year.',
  },
  {
    code: 'BS',
    name: 'Bahamas',
    flag: '🇧🇸',
    continent: 'North America',
    capital: 'Nassau',
    landmark: "Dean's Blue Hole",
    currency: 'Bahamian Dollar',
    currencySymbol: 'B$',
    funFact: 'The Bahamas has a beach with swimming pigs that love to meet visitors.',
  },
  {
    code: 'BB',
    name: 'Barbados',
    flag: '🇧🇧',
    continent: 'North America',
    capital: 'Bridgetown',
    landmark: 'Bridgetown',
    currency: 'Barbadian Dollar',
    currencySymbol: 'Bds$',
    funFact: 'Barbados is the birthplace of rum and has been making it since the 1600s.',
  },
  {
    code: 'BZ',
    name: 'Belize',
    flag: '🇧🇿',
    continent: 'North America',
    capital: 'Belmopan',
    landmark: 'Great Blue Hole',
    currency: 'Belize Dollar',
    currencySymbol: 'BZ$',
    funFact:
      'Belize has the Great Blue Hole, a giant underwater sinkhole that is over 300 meters wide.',
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    continent: 'North America',
    capital: 'Ottawa',
    landmark: 'Niagara Falls',
    currency: 'Canadian Dollar',
    currencySymbol: 'C$',
    funFact: 'Canada has more lakes than all other countries combined.',
  },
  {
    code: 'CR',
    name: 'Costa Rica',
    flag: '🇨🇷',
    continent: 'North America',
    capital: 'San José',
    landmark: 'Arenal Volcano',
    currency: 'Costa Rican Colón',
    currencySymbol: '₡',
    funFact:
      'Costa Rica has no army and uses the money it saves to protect nature and run schools.',
  },
  {
    code: 'CU',
    name: 'Cuba',
    flag: '🇨🇺',
    continent: 'North America',
    capital: 'Havana',
    landmark: 'El Capitolio',
    currency: 'Cuban Peso',
    currencySymbol: '₱',
    funFact:
      'Cuba is famous for its colorful vintage cars from the 1950s that still drive around the streets.',
  },
  {
    code: 'DM',
    name: 'Dominica',
    flag: '🇩🇲',
    continent: 'North America',
    capital: 'Roseau',
    landmark: 'Trafalgar Falls',
    currency: 'East Caribbean Dollar',
    currencySymbol: 'EC$',
    funFact: 'Dominica has a boiling lake, the second largest hot spring in the world.',
  },
  {
    code: 'DO',
    name: 'Dominican Republic',
    flag: '🇩🇴',
    continent: 'North America',
    capital: 'Santo Domingo',
    landmark: 'Alcázar de Colón',
    currency: 'Dominican Peso',
    currencySymbol: 'RD$',
    funFact: 'Santo Domingo was the first permanent European settlement in the Americas.',
  },
  {
    code: 'SV',
    name: 'El Salvador',
    flag: '🇸🇻',
    continent: 'North America',
    capital: 'San Salvador',
    landmark: 'Joya de Cerén',
    currency: 'United States Dollar',
    currencySymbol: '$',
    funFact: 'El Salvador is the smallest and most densely populated country in Central America.',
  },
  {
    code: 'GD',
    name: 'Grenada',
    flag: '🇬🇩',
    continent: 'North America',
    capital: "St. George's",
    landmark: 'Fort George, Grenada',
    currency: 'East Caribbean Dollar',
    currencySymbol: 'EC$',
    funFact:
      'Grenada is called the "Spice Island" because it grows so much nutmeg and other spices.',
  },
  {
    code: 'GT',
    name: 'Guatemala',
    flag: '🇬🇹',
    continent: 'North America',
    capital: 'Guatemala City',
    landmark: 'Tikal',
    currency: 'Guatemalan Quetzal',
    currencySymbol: 'Q',
    funFact:
      'Guatemala was home to the ancient Maya civilization, who built incredible pyramids in the jungle.',
  },
  {
    code: 'HT',
    name: 'Haiti',
    flag: '🇭🇹',
    continent: 'North America',
    capital: 'Port-au-Prince',
    landmark: 'Citadelle Laferrière',
    currency: 'Haitian Gourde',
    currencySymbol: 'G',
    funFact:
      'Haiti was the first Black republic and the second country in the Americas to gain independence.',
  },
  {
    code: 'HN',
    name: 'Honduras',
    flag: '🇭🇳',
    continent: 'North America',
    capital: 'Tegucigalpa',
    landmark: 'Copán',
    currency: 'Honduran Lempira',
    currencySymbol: 'L',
    funFact: 'Honduras has the second largest coral reef in the world.',
  },
  {
    code: 'JM',
    name: 'Jamaica',
    flag: '🇯🇲',
    continent: 'North America',
    capital: 'Kingston',
    landmark: "Dunn's River Falls",
    currency: 'Jamaican Dollar',
    currencySymbol: 'J$',
    funFact: 'Jamaica is the birthplace of reggae music and the legendary Bob Marley.',
  },
  {
    code: 'MX',
    name: 'Mexico',
    flag: '🇲🇽',
    continent: 'North America',
    capital: 'Mexico City',
    landmark: 'Chichén Itzá',
    currency: 'Mexican Peso',
    currencySymbol: '$',
    funFact: 'Mexico introduced chocolate, chili peppers, and corn to the rest of the world.',
  },
  {
    code: 'NI',
    name: 'Nicaragua',
    flag: '🇳🇮',
    continent: 'North America',
    capital: 'Managua',
    landmark: 'Masaya Volcano',
    currency: 'Nicaraguan Córdoba',
    currencySymbol: 'C$',
    funFact: 'Nicaragua has the largest lake in Central America, which has freshwater sharks.',
  },
  {
    code: 'PA',
    name: 'Panama',
    flag: '🇵🇦',
    continent: 'North America',
    capital: 'Panama City',
    landmark: 'BioMuseo',
    currency: 'Panamanian Balboa',
    currencySymbol: 'B/.',
    funFact:
      'The Panama Canal connects the Atlantic and Pacific Oceans and saves ships a 12,000 km trip around South America.',
  },
  {
    code: 'KN',
    name: 'Saint Kitts and Nevis',
    flag: '🇰🇳',
    continent: 'North America',
    capital: 'Basseterre',
    landmark: 'Brimstone Hill Fortress',
    currency: 'East Caribbean Dollar',
    currencySymbol: 'EC$',
    funFact: 'Saint Kitts and Nevis is the smallest country in the Americas.',
  },
  {
    code: 'LC',
    name: 'Saint Lucia',
    flag: '🇱🇨',
    continent: 'North America',
    capital: 'Castries',
    landmark: 'The Pitons',
    currency: 'East Caribbean Dollar',
    currencySymbol: 'EC$',
    funFact:
      'Saint Lucia has two dramatic volcanic peaks called the Pitons that rise straight out of the sea.',
  },
  {
    code: 'VC',
    name: 'Saint Vincent and the Grenadines',
    flag: '🇻🇨',
    continent: 'North America',
    capital: 'Kingstown',
    landmark: 'La Soufrière (volcano)',
    currency: 'East Caribbean Dollar',
    currencySymbol: 'EC$',
    funFact:
      'Parts of the Pirates of the Caribbean movies were filmed on the islands of Saint Vincent.',
  },
  {
    code: 'TT',
    name: 'Trinidad and Tobago',
    flag: '🇹🇹',
    continent: 'North America',
    capital: 'Port of Spain',
    landmark: 'Port of Spain',
    currency: 'Trinidad and Tobago Dollar',
    currencySymbol: 'TT$',
    funFact: "Trinidad has the world's largest natural deposit of asphalt at Pitch Lake.",
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    continent: 'North America',
    capital: 'Washington, D.C.',
    landmark: 'Statue of Liberty',
    currency: 'United States Dollar',
    currencySymbol: '$',
    funFact: 'The United States put the first humans on the Moon in 1969.',
  },

  // ============================================================
  // SOUTH AMERICA (12 countries)
  // ============================================================
  {
    code: 'AR',
    name: 'Argentina',
    flag: '🇦🇷',
    continent: 'South America',
    capital: 'Buenos Aires',
    landmark: 'Iguazú Falls',
    currency: 'Argentine Peso',
    currencySymbol: '$',
    funFact: 'Argentina is the birthplace of tango dancing and is famous for its delicious steak.',
  },
  {
    code: 'BO',
    name: 'Bolivia',
    flag: '🇧🇴',
    continent: 'South America',
    capital: 'Sucre',
    landmark: 'Salar de Uyuni',
    currency: 'Bolivian Boliviano',
    currencySymbol: 'Bs',
    funFact:
      "Bolivia has the world's largest salt flat, so shiny it looks like a giant mirror when it rains.",
  },
  {
    code: 'BR',
    name: 'Brazil',
    flag: '🇧🇷',
    continent: 'South America',
    capital: 'Brasília',
    landmark: 'Christ the Redeemer (statue)',
    currency: 'Brazilian Real',
    currencySymbol: 'R$',
    funFact: "Brazil's Amazon Rainforest produces about 20% of the world's oxygen.",
  },
  {
    code: 'CL',
    name: 'Chile',
    flag: '🇨🇱',
    continent: 'South America',
    capital: 'Santiago',
    landmark: 'Moai',
    currency: 'Chilean Peso',
    currencySymbol: '$',
    funFact:
      'Chile is the longest north-to-south country in the world, stretching over 4,300 kilometers.',
  },
  {
    code: 'CO',
    name: 'Colombia',
    flag: '🇨🇴',
    continent: 'South America',
    capital: 'Bogotá',
    landmark: 'Las Lajas Shrine',
    currency: 'Colombian Peso',
    currencySymbol: '$',
    funFact: 'Colombia has the most species of birds of any country in the world.',
  },
  {
    code: 'EC',
    name: 'Ecuador',
    flag: '🇪🇨',
    continent: 'South America',
    capital: 'Quito',
    landmark: 'Galápagos Islands',
    currency: 'United States Dollar',
    currencySymbol: '$',
    funFact:
      'The Galápagos Islands in Ecuador have animals found nowhere else on Earth, like marine iguanas.',
  },
  {
    code: 'GY',
    name: 'Guyana',
    flag: '🇬🇾',
    continent: 'South America',
    capital: 'Georgetown',
    landmark: 'Kaieteur Falls',
    currency: 'Guyanese Dollar',
    currencySymbol: 'GY$',
    funFact: 'Guyana has Kaieteur Falls, one of the most powerful waterfalls in the world.',
  },
  {
    code: 'PY',
    name: 'Paraguay',
    flag: '🇵🇾',
    continent: 'South America',
    capital: 'Asunción',
    landmark: 'Itaipu Dam',
    currency: 'Paraguayan Guaraní',
    currencySymbol: '₲',
    funFact:
      "Paraguay's flag is one of the few national flags with different designs on the front and back.",
  },
  {
    code: 'PE',
    name: 'Peru',
    flag: '🇵🇪',
    continent: 'South America',
    capital: 'Lima',
    landmark: 'Machu Picchu',
    currency: 'Peruvian Sol',
    currencySymbol: 'S/',
    funFact:
      'Machu Picchu is an ancient Inca city built high in the Andes Mountains over 500 years ago.',
  },
  {
    code: 'SR',
    name: 'Suriname',
    flag: '🇸🇷',
    continent: 'South America',
    capital: 'Paramaribo',
    landmark: 'Fort Zeelandia (Suriname)',
    currency: 'Surinamese Dollar',
    currencySymbol: 'SRD',
    funFact:
      'Suriname is the smallest country in South America and over 90% of it is tropical rainforest.',
  },
  {
    code: 'UY',
    name: 'Uruguay',
    flag: '🇺🇾',
    continent: 'South America',
    capital: 'Montevideo',
    landmark: 'Casapueblo',
    currency: 'Uruguayan Peso',
    currencySymbol: '$U',
    funFact: 'Uruguay hosted and won the very first FIFA World Cup in 1930.',
  },
  {
    code: 'VE',
    name: 'Venezuela',
    flag: '🇻🇪',
    continent: 'South America',
    capital: 'Caracas',
    landmark: 'Angel Falls',
    currency: 'Venezuelan Bolívar',
    currencySymbol: 'Bs.F',
    funFact: 'Venezuela has Angel Falls, the tallest waterfall in the world at 979 meters high.',
  },

  // ============================================================
  // OCEANIA (14 countries)
  // ============================================================
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    continent: 'Oceania',
    capital: 'Canberra',
    landmark: 'Sydney Opera House',
    currency: 'Australian Dollar',
    currencySymbol: 'A$',
    funFact: 'Australia has more kangaroos than people and is home to the Great Barrier Reef.',
  },
  {
    code: 'FJ',
    name: 'Fiji',
    flag: '🇫🇯',
    continent: 'Oceania',
    capital: 'Suva',
    landmark: 'Sri Siva Subramaniya Temple',
    currency: 'Fijian Dollar',
    currencySymbol: 'FJ$',
    funFact:
      'Fiji is made up of over 330 islands, but only about 110 of them have people living on them.',
  },
  {
    code: 'KI',
    name: 'Kiribati',
    flag: '🇰🇮',
    continent: 'Oceania',
    capital: 'Tarawa',
    landmark: 'Bairiki',
    currency: 'Australian Dollar',
    currencySymbol: 'A$',
    funFact: 'Kiribati is the first country in the world to see the sunrise each day.',
  },
  {
    code: 'MH',
    name: 'Marshall Islands',
    flag: '🇲🇭',
    continent: 'Oceania',
    capital: 'Majuro',
    landmark: 'Majuro',
    currency: 'United States Dollar',
    currencySymbol: '$',
    funFact: "The Marshall Islands are home to the world's largest shark sanctuary.",
  },
  {
    code: 'FM',
    name: 'Micronesia',
    flag: '🇫🇲',
    continent: 'Oceania',
    capital: 'Palikir',
    landmark: 'Nan Madol',
    currency: 'United States Dollar',
    currencySymbol: '$',
    funFact:
      'Micronesia has ancient ruins called Nan Madol, sometimes called the "Venice of the Pacific."',
  },
  {
    code: 'NR',
    name: 'Nauru',
    flag: '🇳🇷',
    continent: 'Oceania',
    capital: 'Yaren',
    landmark: 'Buada Lagoon',
    currency: 'Australian Dollar',
    currencySymbol: 'A$',
    funFact: 'Nauru is the third smallest country in the world and the smallest island nation.',
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    flag: '🇳🇿',
    continent: 'Oceania',
    capital: 'Wellington',
    landmark: 'Milford Sound',
    currency: 'New Zealand Dollar',
    currencySymbol: 'NZ$',
    funFact: 'New Zealand was the first country to give women the right to vote in 1893.',
  },
  {
    code: 'PW',
    name: 'Palau',
    flag: '🇵🇼',
    continent: 'Oceania',
    capital: 'Ngerulmud',
    landmark: 'Rock Islands',
    currency: 'United States Dollar',
    currencySymbol: '$',
    funFact:
      "Palau has a lake full of jellyfish that don't sting, so you can swim with them safely.",
  },
  {
    code: 'PG',
    name: 'Papua New Guinea',
    flag: '🇵🇬',
    continent: 'Oceania',
    capital: 'Port Moresby',
    landmark: 'Mount Wilhelm',
    currency: 'Papua New Guinean Kina',
    currencySymbol: 'K',
    funFact: 'Papua New Guinea has over 800 languages, more than any other country in the world.',
  },
  {
    code: 'WS',
    name: 'Samoa',
    flag: '🇼🇸',
    continent: 'Oceania',
    capital: 'Apia',
    landmark: 'Robert Louis Stevenson Museum',
    currency: 'Samoan Tālā',
    currencySymbol: 'T',
    funFact: 'Samoa was the first country in the Pacific to gain independence.',
  },
  {
    code: 'SB',
    name: 'Solomon Islands',
    flag: '🇸🇧',
    continent: 'Oceania',
    capital: 'Honiara',
    landmark: 'Honiara',
    currency: 'Solomon Islands Dollar',
    currencySymbol: 'SI$',
    funFact: 'The Solomon Islands have one of the largest coral reef lagoons in the world.',
  },
  {
    code: 'TO',
    name: 'Tonga',
    flag: '🇹🇴',
    continent: 'Oceania',
    capital: "Nuku'alofa",
    landmark: 'Haʻamonga ʻa Maui',
    currency: "Tongan Pa'anga",
    currencySymbol: 'T$',
    funFact:
      'Tonga is the only Pacific Island nation that was never colonized by a European power.',
  },
  {
    code: 'TV',
    name: 'Tuvalu',
    flag: '🇹🇻',
    continent: 'Oceania',
    capital: 'Funafuti',
    landmark: 'Funafuti',
    currency: 'Australian Dollar',
    currencySymbol: 'A$',
    funFact:
      'Tuvalu is the fourth smallest country in the world and earns money from its ".tv" internet domain.',
  },
  {
    code: 'VU',
    name: 'Vanuatu',
    flag: '🇻🇺',
    continent: 'Oceania',
    capital: 'Port Vila',
    landmark: 'Mount Yasur',
    currency: 'Vanuatu Vatu',
    currencySymbol: 'VT',
    funFact:
      'Vanuatu is home to Mount Yasur, one of the most accessible active volcanoes in the world.',
  },
];

/** Capital city coordinates [latitude, longitude] keyed by country code */
export const CAPITAL_COORDINATES: Record<string, [number, number]> = {
  // ============================================================
  // AFRICA (54 countries)
  // ============================================================
  DZ: [36.7538, 3.0588], // Algiers
  AO: [-8.839, 13.2894], // Luanda
  BJ: [6.4969, 2.6289], // Porto-Novo
  BW: [-24.6282, 25.9231], // Gaborone
  BF: [12.3714, -1.5197], // Ouagadougou
  BI: [-3.4264, 29.9323], // Gitega
  CV: [14.9331, -23.5133], // Praia
  CM: [3.848, 11.5021], // Yaoundé
  CF: [4.3947, 18.5582], // Bangui
  TD: [12.1348, 15.0557], // N'Djamena
  KM: [-11.7172, 43.2551], // Moroni
  CG: [-4.2634, 15.2429], // Brazzaville
  CD: [-4.4419, 15.2663], // Kinshasa
  CI: [6.8276, -5.2893], // Yamoussoukro
  DJ: [11.5721, 43.1456], // Djibouti
  EG: [30.0444, 31.2357], // Cairo
  GQ: [3.7504, 8.7371], // Malabo
  ER: [15.3229, 38.9251], // Asmara
  SZ: [-26.3054, 31.1367], // Mbabane
  ET: [9.025, 38.7469], // Addis Ababa
  GA: [0.4162, 9.4673], // Libreville
  GM: [13.4549, -16.579], // Banjul
  GH: [5.6037, -0.187], // Accra
  GN: [9.6412, -13.5784], // Conakry
  GW: [11.8037, -15.1804], // Bissau
  KE: [-1.2921, 36.8219], // Nairobi
  LS: [-29.3167, 27.4833], // Maseru
  LR: [6.2907, -10.7605], // Monrovia
  LY: [32.8872, 13.1913], // Tripoli
  MG: [-18.8792, 47.5079], // Antananarivo
  MW: [-13.9626, 33.7741], // Lilongwe
  ML: [12.6392, -8.0029], // Bamako
  MR: [18.0735, -15.9582], // Nouakchott
  MU: [-20.1609, 57.5012], // Port Louis
  MA: [34.0209, -6.8416], // Rabat
  MZ: [-25.9692, 32.5732], // Maputo
  NA: [-22.5609, 17.0658], // Windhoek
  NE: [13.5127, 2.1128], // Niamey
  NG: [9.0765, 7.3986], // Abuja
  RW: [-1.9403, 29.8739], // Kigali
  ST: [0.1864, 6.6131], // São Tomé
  SN: [14.7167, -17.4677], // Dakar
  SC: [-4.6191, 55.4513], // Victoria
  SL: [8.4657, -13.2317], // Freetown
  SO: [2.0469, 45.3182], // Mogadishu
  ZA: [-25.7479, 28.2293], // Pretoria
  SS: [4.8594, 31.5713], // Juba
  SD: [15.5007, 32.5599], // Khartoum
  TZ: [-6.163, 35.7516], // Dodoma
  TG: [6.1256, 1.2254], // Lomé
  TN: [36.8065, 10.1815], // Tunis
  UG: [0.3476, 32.5825], // Kampala
  ZM: [-15.3875, 28.3228], // Lusaka
  ZW: [-17.8252, 31.0335], // Harare

  // ============================================================
  // ASIA (48 countries)
  // ============================================================
  AF: [34.5553, 69.2075], // Kabul
  AM: [40.1792, 44.4991], // Yerevan
  AZ: [40.4093, 49.8671], // Baku
  BH: [26.2285, 50.586], // Manama
  BD: [23.8103, 90.4125], // Dhaka
  BT: [27.4728, 89.639], // Thimphu
  BN: [4.9031, 114.9398], // Bandar Seri Begawan
  KH: [11.5564, 104.9282], // Phnom Penh
  CN: [39.9042, 116.4074], // Beijing
  CY: [35.1856, 33.3823], // Nicosia
  GE: [41.7151, 44.8271], // Tbilisi
  IN: [28.6139, 77.209], // New Delhi
  ID: [-6.2088, 106.8456], // Jakarta
  IR: [35.6892, 51.389], // Tehran
  IQ: [33.3152, 44.3661], // Baghdad
  IL: [31.7683, 35.2137], // Jerusalem
  JP: [35.6762, 139.6503], // Tokyo
  JO: [31.9454, 35.9284], // Amman
  KZ: [51.1694, 71.4491], // Astana
  KW: [29.3759, 47.9774], // Kuwait City
  KG: [42.8746, 74.5698], // Bishkek
  LA: [17.9757, 102.6331], // Vientiane
  LB: [33.8938, 35.5018], // Beirut
  MY: [3.139, 101.6869], // Kuala Lumpur
  MV: [4.1755, 73.5093], // Malé
  MN: [47.8864, 106.9057], // Ulaanbaatar
  MM: [19.7633, 96.0785], // Naypyidaw
  NP: [27.7172, 85.324], // Kathmandu
  KP: [39.0392, 125.7625], // Pyongyang
  OM: [23.588, 58.3829], // Muscat
  PK: [33.6844, 73.0479], // Islamabad
  PS: [31.9038, 35.2034], // Ramallah
  PH: [14.5995, 120.9842], // Manila
  QA: [25.2854, 51.531], // Doha
  SA: [24.7136, 46.6753], // Riyadh
  SG: [1.3521, 103.8198], // Singapore
  KR: [37.5665, 126.978], // Seoul
  LK: [6.9271, 79.8612], // Sri Jayawardenepura Kotte
  SY: [33.5138, 36.2765], // Damascus
  TJ: [38.5598, 68.774], // Dushanbe
  TH: [13.7563, 100.5018], // Bangkok
  TL: [-8.5569, 125.5603], // Dili
  TR: [39.9334, 32.8597], // Ankara
  TM: [37.9601, 58.3261], // Ashgabat
  AE: [24.4539, 54.3773], // Abu Dhabi
  UZ: [41.2995, 69.2401], // Tashkent
  VN: [21.0278, 105.8342], // Hanoi
  YE: [15.3694, 44.191], // Sanaa

  // ============================================================
  // EUROPE (44 countries)
  // ============================================================
  AL: [41.3275, 19.8187], // Tirana
  AD: [42.5063, 1.5218], // Andorra la Vella
  AT: [48.2082, 16.3738], // Vienna
  BY: [53.9006, 27.559], // Minsk
  BE: [50.8503, 4.3517], // Brussels
  BA: [43.8563, 18.4131], // Sarajevo
  BG: [42.6977, 23.3219], // Sofia
  HR: [45.815, 15.9819], // Zagreb
  CZ: [50.0755, 14.4378], // Prague
  DK: [55.6761, 12.5683], // Copenhagen
  EE: [59.437, 24.7536], // Tallinn
  FI: [60.1699, 24.9384], // Helsinki
  FR: [48.8566, 2.3522], // Paris
  DE: [52.52, 13.405], // Berlin
  GR: [37.9838, 23.7275], // Athens
  HU: [47.4979, 19.0402], // Budapest
  IS: [64.1466, -21.9426], // Reykjavik
  IE: [53.3498, -6.2603], // Dublin
  IT: [41.9028, 12.4964], // Rome
  XK: [42.6629, 21.1655], // Pristina
  LV: [56.9496, 24.1052], // Riga
  LI: [47.141, 9.5209], // Vaduz
  LT: [54.6872, 25.2797], // Vilnius
  LU: [49.6117, 6.13], // Luxembourg City
  MT: [35.8989, 14.5146], // Valletta
  MD: [47.0105, 28.8638], // Chișinău
  MC: [43.7384, 7.4246], // Monaco
  ME: [42.4304, 19.2594], // Podgorica
  NL: [52.3676, 4.9041], // Amsterdam
  MK: [41.9973, 21.428], // Skopje
  NO: [59.9139, 10.7522], // Oslo
  PL: [52.2297, 21.0122], // Warsaw
  PT: [38.7223, -9.1393], // Lisbon
  RO: [44.4268, 26.1025], // Bucharest
  RU: [55.7558, 37.6173], // Moscow
  SM: [43.9424, 12.4578], // San Marino
  RS: [44.7866, 20.4489], // Belgrade
  SK: [48.1486, 17.1077], // Bratislava
  SI: [46.0569, 14.5058], // Ljubljana
  ES: [40.4168, -3.7038], // Madrid
  SE: [59.3293, 18.0686], // Stockholm
  CH: [46.948, 7.4474], // Bern
  UA: [50.4501, 30.5234], // Kyiv
  GB: [51.5074, -0.1278], // London
  VA: [41.9029, 12.4534], // Vatican City

  // ============================================================
  // NORTH AMERICA (23 countries)
  // ============================================================
  AG: [17.1274, -61.8468], // St. John's
  BS: [25.048, -77.3554], // Nassau
  BB: [13.1132, -59.5988], // Bridgetown
  BZ: [17.251, -88.759], // Belmopan
  CA: [45.4215, -75.6972], // Ottawa
  CR: [9.9281, -84.0907], // San José
  CU: [23.1136, -82.3666], // Havana
  DM: [15.301, -61.387], // Roseau
  DO: [18.4861, -69.9312], // Santo Domingo
  SV: [13.6929, -89.2182], // San Salvador
  GD: [12.0564, -61.7485], // St. George's
  GT: [14.6349, -90.5069], // Guatemala City
  HT: [18.5944, -72.3074], // Port-au-Prince
  HN: [14.0723, -87.1921], // Tegucigalpa
  JM: [18.0179, -76.8099], // Kingston
  MX: [19.4326, -99.1332], // Mexico City
  NI: [12.115, -86.2362], // Managua
  PA: [8.9824, -79.5199], // Panama City
  KN: [17.3026, -62.7177], // Basseterre
  LC: [14.0101, -60.9875], // Castries
  VC: [13.16, -61.2248], // Kingstown
  TT: [10.6596, -61.5086], // Port of Spain
  US: [38.9072, -77.0369], // Washington, D.C.

  // ============================================================
  // SOUTH AMERICA (12 countries)
  // ============================================================
  AR: [-34.6037, -58.3816], // Buenos Aires
  BO: [-19.0196, -65.2619], // Sucre
  BR: [-15.7975, -47.8919], // Brasília
  CL: [-33.4489, -70.6693], // Santiago
  CO: [4.711, -74.0721], // Bogotá
  EC: [-0.1807, -78.4678], // Quito
  GY: [6.8013, -58.1551], // Georgetown
  PY: [-25.2637, -57.5759], // Asunción
  PE: [-12.0464, -77.0428], // Lima
  SR: [5.852, -55.2038], // Paramaribo
  UY: [-34.9011, -56.1645], // Montevideo
  VE: [10.4806, -66.9036], // Caracas

  // ============================================================
  // OCEANIA (14 countries)
  // ============================================================
  AU: [-35.2809, 149.13], // Canberra
  FJ: [-18.1416, 178.4419], // Suva
  KI: [1.3382, 173.0176], // Tarawa
  MH: [7.1164, 171.1858], // Majuro
  FM: [6.9248, 158.161], // Palikir
  NR: [-0.5477, 166.9209], // Yaren
  NZ: [-41.2865, 174.7762], // Wellington
  PW: [7.5006, 134.6242], // Ngerulmud
  PG: [-6.3149, 147.1803], // Port Moresby
  WS: [-13.8333, -171.75], // Apia
  SB: [-9.4456, 159.9729], // Honiara
  TO: [-21.2085, -175.1982], // Nuku'alofa
  TV: [-8.5211, 179.1983], // Funafuti
  VU: [-17.7334, 168.3273], // Port Vila
};

/**
 * Returns all countries belonging to a specific continent.
 */
export function getCountriesByContinent(continent: string): Country[] {
  return COUNTRIES.filter((country) => country.continent === continent);
}

/**
 * Returns a record mapping each continent to its number of countries.
 */
export function getContinentCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const continent of CONTINENTS) {
    counts[continent] = COUNTRIES.filter((c) => c.continent === continent).length;
  }
  return counts;
}
