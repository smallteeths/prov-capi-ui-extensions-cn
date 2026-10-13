function getQueryParamsString(params, deep = false) {
  const keys = Object.keys(params).sort((a, b) => {
    return a < b ? -1 : 1;
  });

  return keys.map((key) => {
    if (params[key] === undefined) {
      return '';
    }

    return `${ key }${ deep ? encodeURIComponent('=') : '=' }${ encodeURIComponent(params[key]) }`;
  }).join(deep ? encodeURIComponent('&') : '&');
}

function tencentCloudSDKError(error) {
  const body = error.replace('[TencentCloudSDKError] ', '').split(',');
  const obj = {};

  body.forEach((item) => {
    const arr = item.split('=');

    obj[arr[0].trim()] = arr[1].trim();
  });

  return obj;
}

export async function queryFromTencent({
  resource = '',
  cloudCredentialId,
  store,
  externalParams = {},
} = {}) {
  let acceptLanguage = 'zh-CN';

  if (store.getters['i18n/current']() === 'en-us') {
    acceptLanguage = 'en-US';
  }

  externalParams.language = acceptLanguage;
  const url = `/meta/tke/${ resource }`;
  const query = Object.assign({}, externalParams, { cloudCredentialId });

  const req = {
    url:    `${ url }?${ getQueryParamsString(query) }`,
    method: 'GET',
  };

  try {
    const res = await store.dispatch('cluster/request', req);

    return res.body || res;
  } catch (err) {
    let message = err.body?.message;

    if (message && message.includes('TencentCloudSDKError')) {
      message = tencentCloudSDKError(message)['Message'];
    } else {
      message = err.body?.error || JSON.stringify(err);
    }

    throw message;
  }
}
