const responseFormatter = (req: any, res: any, next: any) => {
  const oldJson = res.json;

  res.json = function (data: any) {
    if (!data) {
      return oldJson.call(this, data);
    }

    try {
      // Handle success response format
      if (data.success === true && data.data) {
        data.data = transformData(data.data);
        return oldJson.call(this, data);
      }

      // Handle direct data
      data = transformData(data);
      return oldJson.call(this, data);
    } catch (error) {
      console.error('Error in response formatter:', error);
      // If transformation fails, use original data
      return oldJson.call(this, data);
    }
  };

  next();
};

/**
 * Transform data to add id while keeping _id
 */
function transformData(data: any): any {
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => transformData(item));
  }

  // Handle objects
  if (data && typeof data === 'object' && !isDate(data)) {
    // Create a new object for the result
    const result: any = {};
    
    // If it's a Mongoose document, convert to plain object
    const obj = data.toObject ? data.toObject() : data;
    
    // Add id field if _id exists, but keep _id as well
    if (obj._id) {
      result.id = obj._id.toString();
      result._id = obj._id;
    }
    
    // Copy all properties
    for (const key in obj) {
      if (key !== '_id') { // Skip _id as we've already handled it
        // Recursively transform nested objects
        result[key] = transformData(obj[key]);
      }
    }
    
    return result;
  }
  
  // Return primitive values as is
  return data;
}

/**
 * Check if value is a Date object
 */
function isDate(value: any): boolean {
  return value instanceof Date || 
    (typeof value === 'object' && 
     Object.prototype.toString.call(value) === '[object Date]');
}

export default responseFormatter;
  