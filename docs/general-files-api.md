# General Files API Documentation

## 📋 Overview

General Files API cung cấp 3 endpoints chính để quản lý và truy xuất thông tin về các file chung trong hệ thống EMR:

1. **GET `/api/v1/general-files`** - Lấy danh sách tất cả files (dạng phẳng)
2. **GET `/api/v1/general-files/by-categories`** - Lấy danh sách files nhóm theo category ⭐ **RECOMMENDED**
3. **GET `/api/v1/general-files/:id`** - Lấy thông tin chi tiết của một file

## 🎯 API Endpoint: List Files By Categories

### Endpoint Details

```
GET /api/v1/general-files/by-categories
Content-Type: application/json
```

### Description

API này trả về tất cả files được nhóm theo category, rất hữu ích cho frontend để hiển thị files theo từng danh mục một cách có tổ chức.

## 📤 Request

```http
GET /api/v1/general-files/by-categories
```

**Parameters:** Không có parameters

## 📥 Response Format

### Success Response (200 OK)

```json
{
  "total_files": number,
  "total_categories": number,
  "categories": [
    {
      "category_id": number,
      "category_name": string,
      "category_description": string,
      "file_count": number,
      "files": [
        {
          "id": number,
          "file_name": string,
          "file_type": string,
          "file_size": number,
          "uploaded_at": string,
          "send_emr_at": string
        }
      ]
    }
  ]
}
```

## 📊 Real Example Response

```json
{
  "total_files": 5,
  "total_categories": 2,
  "categories": [
    {
      "category_id": 10,
      "category_name": "Hàng danh mục thuốc",
      "category_description": "Danh mục thuốc là bảng dữ liệu chứa thông tin chi tiết về tất cả các loại thuốc được quản lý, bao gồm mã thuốc, tên hoạt chất, tên thương mại, dạng bào chế, hàm lượng, đơn vị tính, nhà sản xuất, nhóm điều trị, giá bán, và trạng thái sử dụng",
      "file_count": 2,
      "files": [
        {
          "id": 13,
          "file_name": "Hàng danh mục thuốc",
          "file_type": "docx",
          "file_size": 8010,
          "uploaded_at": "2025-08-08T16:33:01",
          "send_emr_at": "2025-08-08T16:33:35"
        },
        {
          "id": 14,
          "file_name": "Danh muc thuoc",
          "file_type": "docx",
          "file_size": 10730,
          "uploaded_at": "2025-08-08T16:33:01",
          "send_emr_at": "2025-08-08T16:33:35"
        }
      ]
    },
    {
      "category_id": 11,
      "category_name": "Trang thiết bị y tế",
      "category_description": "Danh sánh trang thiết bị y tế",
      "file_count": 3,
      "files": [
        {
          "id": 10,
          "file_name": "Mẫu phiếu khám",
          "file_type": "docx",
          "file_size": 7627,
          "uploaded_at": "2025-08-08T16:32:47",
          "send_emr_at": "2025-08-08T16:33:35"
        },
        {
          "id": 11,
          "file_name": "Phiếu chỉ định xét nghiệm sinh hóa - miễn dịch",
          "file_type": "docx",
          "file_size": 8636,
          "uploaded_at": "2025-08-08T16:32:47",
          "send_emr_at": "2025-08-08T16:33:35"
        },
        {
          "id": 12,
          "file_name": "Phiếu thu dịch vụ y tế",
          "file_type": "docx",
          "file_size": 9682,
          "uploaded_at": "2025-08-08T16:32:47",
          "send_emr_at": "2025-08-08T16:33:35"
        }
      ]
    }
  ]
}
```

## 💡 Frontend Use Cases

### 1. Hiển thị Files theo Categories

```jsx
// React Example
function FilesByCategory({ data }) {
  return (
    <div className="files-container">
      <div className="summary">
        <span>
          Tổng cộng: {data.total_files} files trong {data.total_categories} danh
          mục
        </span>
      </div>

      {data.categories.map((category) => (
        <div key={category.category_id} className="category-section">
          <h3>{category.category_name}</h3>
          <p className="category-desc">{category.category_description}</p>
          <span className="file-count">{category.file_count} files</span>

          <div className="files-grid">
            {category.files.map((file) => (
              <div key={file.id} className="file-card">
                <h4>{file.file_name}</h4>
                <div className="file-meta">
                  <span>{file.file_type.toUpperCase()}</span>
                  <span>{formatFileSize(file.file_size)}</span>
                  <span>{formatDate(file.uploaded_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 2. Tạo Category Navigation

```jsx
// Category sidebar navigation
function CategoryNavigation({ categories }) {
  return (
    <nav className="category-nav">
      {categories.map((category) => (
        <a
          key={category.category_id}
          href={`#category-${category.category_id}`}
          className="nav-item"
        >
          {category.category_name}
          <span className="badge">{category.file_count}</span>
        </a>
      ))}
    </nav>
  );
}
```

### 3. Search & Filter trong Categories

```jsx
function FilterableFilesByCategory() {
  const [data, setData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter files based on search term
  const filteredCategories = data?.categories
    .map((category) => ({
      ...category,
      files: category.files.filter((file) =>
        file.file_name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    }))
    .filter((category) => category.files.length > 0);

  return (
    <div>
      <input
        type="text"
        placeholder="Tìm kiếm files..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <FilesByCategory
        data={{
          ...data,
          categories: filteredCategories,
        }}
      />
    </div>
  );
}
```

## 🔧 JavaScript/TypeScript Integration

### TypeScript Interfaces

```typescript
interface GeneralFile {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  send_emr_at: string;
}

interface FileCategory {
  category_id: number;
  category_name: string;
  category_description: string;
  file_count: number;
  files: GeneralFile[];
}

interface FilesByCategoriesResponse {
  total_files: number;
  total_categories: number;
  categories: FileCategory[];
}
```

### API Call Examples

#### Using Fetch

```javascript
async function getFilesByCategories() {
  try {
    const response = await fetch('/api/v1/general-files/by-categories');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching files by categories:', error);
    throw error;
  }
}
```

#### Using Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
});

export const getFilesByCategories = async () => {
  try {
    const response = await api.get('/general-files/by-categories');
    return response.data;
  } catch (error) {
    console.error('Error fetching files by categories:', error);
    throw error;
  }
};
```

#### Using React Query

```jsx
import { useQuery } from 'react-query';

function useFilesByCategories() {
  return useQuery('files-by-categories', getFilesByCategories, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Usage in component
function FilesPage() {
  const { data, isLoading, error } = useFilesByCategories();

  if (isLoading) return <div>Đang tải...</div>;
  if (error) return <div>Có lỗi xảy ra: {error.message}</div>;

  return <FilesByCategory data={data} />;
}
```

## 🛠️ Utility Functions

### Format File Size

```javascript
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

### Format Date

```javascript
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
```

### Get File Icon

```javascript
function getFileIcon(fileType) {
  const icons = {
    docx: '📄',
    pdf: '📕',
    xlsx: '📊',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
  };
  return icons[fileType.toLowerCase()] || '📁';
}
```

## 🎨 CSS Classes Suggestions

```css
.files-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.summary {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 30px;
  text-align: center;
}

.category-section {
  margin-bottom: 40px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.category-header {
  background: #3498db;
  color: white;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-desc {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  margin: 5px 0 0 0;
}

.file-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  padding: 20px;
}

.file-card {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 15px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.file-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.file-meta {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: #666;
}

.category-nav {
  position: sticky;
  top: 20px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
}

.nav-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  text-decoration: none;
  color: #333;
  border-radius: 4px;
  margin-bottom: 5px;
}

.nav-item:hover {
  background: #f8f9fa;
}

.badge {
  background: #e74c3c;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
}
```

## 🚀 Performance Tips

1. **Caching**: Cache response trong 5-10 phút
2. **Loading States**: Hiển thị skeleton loading
3. **Lazy Loading**: Load files theo từng category khi user scroll
4. **Virtual Scrolling**: Nếu có quá nhiều files
5. **Search Debouncing**: Debounce search input 300ms

## 🔗 Related APIs

- **File Detail**: `GET /api/v1/general-files/:id` - Lấy thông tin chi tiết khi user click vào file
- **All Files (Flat)**: `GET /api/v1/general-files` - Lấy danh sách phẳng nếu cần

## 📝 Notes

- API trả về files được sắp xếp theo `category_id`, `uploaded_at DESC`
- File sizes tính bằng bytes
- Dates theo format ISO 8601
- Tất cả files hiện tại đều là định dạng `.docx`
- API sử dụng ClickHouse database `emr_general_files`
