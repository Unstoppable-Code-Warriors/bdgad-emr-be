export interface DoctorInfo {
  id: number;
  email: string;
  name: string;
  phone: string;
  address: string;
}

export const PREDEFINED_DOCTORS: DoctorInfo[] = [
  {
    id: 1,
    email: 'ppp072003@gmail.com',
    name: 'Bác Sĩ Một',
    phone: '0393270113',
    address: '',
  },
  {
    id: 2,
    email: 'fptaiez@gmail.com',
    name: 'Bác Sĩ Hai',
    phone: '0393270114',
    address: '',
  },
  {
    id: 3,
    email: 'phongphhe176151@fpt.edu.vn',
    name: 'Bác Sĩ Ba',
    phone: '0393270115',
    address: '',
  },
  {
    id: 4,
    email: 'phamphong137.dev@gmail.com',
    name: 'Bác Sĩ Bốn',
    phone: '0393270116',
    address: '',
  },
  {
    id: 5,
    email: 'ngosythang123456@gmail.com',
    name: 'Bác Sĩ Năm',
    phone: '0393270117',
    address: '',
  },
];
