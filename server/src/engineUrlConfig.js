const searchEnginesGeneral = {
  google: "https://www.google.com/search?q=[[SEARCH_QUERY]]",
  // bing: "https://www.bing.com/search?q=[[SEARCH_QUERY]]",
  // tusk: "https://tusksearch.com/search?q=[[SEARCH_QUERY]]&p=1&l=center",
  // duck: "https://duckduckgo.com/?q=[[SEARCH_QUERY]]",
  // brave: 'https://search.brave.com/search?q=[[SEARCH_QUERY]]',
};
const searchEnginesNews = {
  google: "https://www.google.com/search?q=[[SEARCH_QUERY]]&tbm=nws",
  bing: "https://www.bing.com/news/search?q=[[SEARCH_QUERY]]",
  tusk: "https://tusksearch.com/search?q=[[SEARCH_QUERY]]&p=1&l=center",
  duck: "https://duckduckgo.com/?q=[[SEARCH_QUERY]]&ia=news&iar=news",
  // brave: 'https://search.brave.com/news?q=[[SEARCH_QUERY]]',
};
module.exports = {
  searchEnginesNews,
  searchEnginesGeneral,
};
