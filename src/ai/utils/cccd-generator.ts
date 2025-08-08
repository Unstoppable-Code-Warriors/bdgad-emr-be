// CCCD Format: 12 digits
// - First 3 digits: Province/City code
// - Next 1 digit: Century + Gender code
// - Next 2 digits: Last 2 digits of birth year
// - Last 6 digits: Random numbers

export interface CCCDGeneratorOptions {
  gender: 'Nam' | 'Nữ';
  birthYear: number;
  provinceCode?: string;
}

// Common province codes
const PROVINCE_CODES = {
  'Hà Nội': '001',
  'TP.HCM': '079',
  'Đà Nẵng': '048',
  'Cần Thơ': '092',
  'Hải Phòng': '031',
  'Nghệ An': '040',
  'Thanh Hóa': '038',
  'Nam Định': '036',
  'Thái Bình': '034',
  'Hưng Yên': '033',
};

export function generateCCCD(options: CCCDGeneratorOptions): string {
  const { gender, birthYear, provinceCode } = options;

  // First 3 digits: Province code (random if not specified)
  const province = provinceCode || getRandomProvinceCode();

  // Next 1 digit: Century + Gender code
  const centuryGenderCode = getCenturyGenderCode(gender, birthYear);

  // Next 2 digits: Last 2 digits of birth year
  const yearSuffix = (birthYear % 100).toString().padStart(2, '0');

  // Last 6 digits: Random numbers
  const randomDigits = generateRandomDigits(6);

  return `${province}${centuryGenderCode}${yearSuffix}${randomDigits}`;
}

function getCenturyGenderCode(gender: 'Nam' | 'Nữ', birthYear: number): string {
  const century = Math.floor(birthYear / 100);
  const isMale = gender === 'Nam';

  switch (century) {
    case 19: // 20th century (1900-1999)
      return isMale ? '0' : '1';
    case 20: // 21st century (2000-2099)
      return isMale ? '2' : '3';
    case 21: // 22nd century (2100-2199)
      return isMale ? '4' : '5';
    case 22: // 23rd century (2200-2299)
      return isMale ? '6' : '7';
    case 23: // 24th century (2300-2399)
      return isMale ? '8' : '9';
    default:
      // Default to 21st century
      return isMale ? '2' : '3';
  }
}

function getRandomProvinceCode(): string {
  const codes = Object.values(PROVINCE_CODES);
  return codes[Math.floor(Math.random() * codes.length)];
}

function generateRandomDigits(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

export { PROVINCE_CODES };
