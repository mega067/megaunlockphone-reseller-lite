const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testLogin() {
  const loginUrl = 'https://latamgsm.com/login';
  const challengeUrl = 'https://latamgsm.com/two-factor-challenge';
  const historyUrl = 'https://latamgsm.com/GENERAL-historial';
  const totpCode = '378975'; // Provided TOTP code
  
  try {
    // 1. GET login page to get CSRF token and cookies
    console.log('Fetching login page...');
    const getRes = await axios.get(loginUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    let cookies = getRes.headers['set-cookie'] || [];
    let cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
    
    // Parse CSRF token
    const tokenMatch = getRes.data.match(/name="_token"\s+value="([^"]+)"/);
    if (!tokenMatch) {
      console.error('Could not find CSRF token!');
      return;
    }
    const token = tokenMatch[1];
    console.log('CSRF Token found:', token);
    
    // 2. POST login credentials
    console.log('Logging in...');
    const params = new URLSearchParams();
    params.append('_token', token);
    params.append('email', 'angeljuares067@gmail.com');
    params.append('password', 'angel067L');
    
    const postRes = await axios.post(loginUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    let loggedCookies = postRes.headers['set-cookie'] || [];
    let mergedCookie = [...cookies, ...loggedCookies].map(c => c.split(';')[0]).join('; ');
    
    console.log('Login response status:', postRes.status);
    console.log('Login response data:', postRes.data);
    
    if (postRes.data && postRes.data.two_factor) {
      console.log('2FA required. Submitting TOTP code...');
      
      // We must get CSRF token from two-factor-challenge page or use the same one
      const challengeGet = await axios.get(challengeUrl, {
        headers: {
          'Cookie': mergedCookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const chalCookies = challengeGet.headers['set-cookie'] || [];
      mergedCookie = [...cookies, ...loggedCookies, ...chalCookies].map(c => c.split(';')[0]).join('; ');
      
      const chalTokenMatch = challengeGet.data.match(/name="_token"\s+value="([^"]+)"/);
      const chalToken = chalTokenMatch ? chalTokenMatch[1] : token;
      
      const chalParams = new URLSearchParams();
      chalParams.append('_token', chalToken);
      chalParams.append('code', totpCode);
      
      const chalPostRes = await axios.post(challengeUrl, chalParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': mergedCookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      console.log('2FA post response status:', chalPostRes.status);
      const postChalCookies = chalPostRes.headers['set-cookie'] || [];
      mergedCookie = [...cookies, ...loggedCookies, ...chalCookies, ...postChalCookies].map(c => c.split(';')[0]).join('; ');
    }
    
    // 3. Fetch history page
    console.log('Fetching history page...');
    const historyRes = await axios.get(historyUrl, {
      headers: {
        'Cookie': mergedCookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('History page fetched successfully!');
    fs.writeFileSync(path.join(__dirname, 'history_page.html'), historyRes.data);
    
  } catch (error) {
    console.error('Error occurred:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testLogin();
