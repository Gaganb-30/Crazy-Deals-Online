// utils/addressValidator.js
const validateAddress = (address) => {
  const errors = [];

  if (!address) {
    errors.push("Address is required");
    return { isValid: false, errors };
  }

  const requiredFields = ["hNo", "street", "city", "state", "zipCode"];
  const fieldLabels = {
    hNo: "House/Flat Number",
    street: "Street Address",
    city: "City",
    state: "State",
    zipCode: "ZIP Code",
  };

  // Check for required fields
  for (const field of requiredFields) {
    if (!address[field] || address[field].trim() === "") {
      errors.push(`${fieldLabels[field]} is required`);
    }
  }

  // Check for default "Not provided" values
  if (
    address.hNo === "Not provided" ||
    address.street === "Not provided" ||
    address.city === "Not provided" ||
    address.state === "Not provided"
  ) {
    errors.push("Please provide complete address details");
  }

  // Validate ZIP code format
  if (address.zipCode && !/^\d{6}$/.test(address.zipCode)) {
    errors.push("ZIP code must be 6 digits");
  }

  // Validate ZIP code is not default
  if (address.zipCode === "000000") {
    errors.push("Please provide a valid ZIP code");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const isAddressComplete = (address) => {
  if (!address) return false;

  const requiredFields = ["hNo", "street", "city", "state", "zipCode"];
  const hasAllFields = requiredFields.every(
    (field) =>
      address[field] &&
      address[field].trim() !== "" &&
      address[field] !== "Not provided"
  );

  const hasValidZip =
    address.zipCode &&
    /^\d{6}$/.test(address.zipCode) &&
    address.zipCode !== "000000";

  return hasAllFields && hasValidZip;
};

module.exports = { validateAddress, isAddressComplete };
